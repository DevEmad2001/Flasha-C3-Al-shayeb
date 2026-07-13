"""Upload AlShaibHousing deploy bundle and start Docker on server."""
import os
import sys
import stat

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "194.163.157.119")
USER = os.environ.get("DEPLOY_USER", "adminftp")
PASSWORD = os.environ.get("DEPLOY_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set DEPLOY_PASSWORD env var before running this script.")
REMOTE_BASE = "/home/adminftp/AlShaibHousing"
LOCAL_BASE = os.path.join(os.path.dirname(__file__), "publish")
DEPLOY_LOCAL = os.path.dirname(__file__)


def ensure_remote_dir(sftp, remote_path: str):
    parts = remote_path.strip("/").split("/")
    current = ""
    for part in parts:
        current += "/" + part
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)


def upload_dir(sftp, local_dir: str, remote_dir: str):
    ensure_remote_dir(sftp, remote_dir)
    for root, dirs, files in os.walk(local_dir):
        rel = os.path.relpath(root, local_dir).replace("\\", "/")
        remote_root = remote_dir if rel == "." else f"{remote_dir}/{rel}"
        ensure_remote_dir(sftp, remote_root)
        for name in files:
            local_file = os.path.join(root, name)
            remote_file = f"{remote_root}/{name}"
            print(f"  upload {remote_file}")
            sftp.put(local_file, remote_file)


def upload_file(sftp, local_file: str, remote_file: str):
    ensure_remote_dir(sftp, os.path.dirname(remote_file))
    print(f"  upload {remote_file}")
    sftp.put(local_file, remote_file)


def run_ssh(ssh, cmd: str, timeout=300):
    print(f"\n$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return code, out, err


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, 22, USER, PASSWORD, timeout=30)
    sftp = ssh.open_sftp()

    print("\n=== Uploading files ===")
    upload_dir(sftp, os.path.join(LOCAL_BASE, "api"), f"{REMOTE_BASE}/api")
    upload_dir(sftp, os.path.join(LOCAL_BASE, "web"), f"{REMOTE_BASE}/web")

    deploy_files = [
        "docker-compose.yml",
        "Dockerfile.api",
        "Dockerfile.web",
        "start-node.mjs",
        "nginx-alshaib-turbo-erp.conf",
        "install-alshaib-domain-root.sh",
    ]
    for name in deploy_files:
        upload_file(sftp, os.path.join(DEPLOY_LOCAL, name), f"{REMOTE_BASE}/deploy/{name}")

    sftp.chmod(f"{REMOTE_BASE}/deploy/install-alshaib-domain-root.sh", stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
    sftp.close()

    print("\n=== Building and starting Docker ===")
    code, _, _ = run_ssh(
        ssh,
        f"cd {REMOTE_BASE}/deploy && docker compose -f docker-compose.yml build && docker compose -f docker-compose.yml up -d",
        timeout=600,
    )
    if code != 0:
        print("Docker compose failed!")
        ssh.close()
        sys.exit(1)

    print("\n=== Health checks ===")
    run_ssh(ssh, "docker ps --filter name=alshaib --format '{{.Names}} {{.Status}} {{.Ports}}'")
    run_ssh(ssh, "sleep 8 && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5200/api/health || true")
    run_ssh(ssh, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/ || true")

    print("\n=== Try nginx install as root ===")
    root_ssh = paramiko.SSHClient()
    root_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        root_ssh.connect(HOST, 22, "root", PASSWORD, timeout=15)
        run_ssh(root_ssh, f"bash {REMOTE_BASE}/deploy/install-alshaib-domain-root.sh", timeout=120)
        root_ssh.close()
    except Exception as e:
        print(f"Root login failed ({e}). Nginx/SSL must be installed manually as root.")

    ssh.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
