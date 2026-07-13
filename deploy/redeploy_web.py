"""Upload web build and restart alshaib-web container."""
import os
import stat
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "194.163.157.119")
USER = os.environ.get("DEPLOY_USER", "adminftp")
PASSWORD = os.environ.get("DEPLOY_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set DEPLOY_PASSWORD env var before running this script.")
REMOTE = "/home/adminftp/AlShaibHousing"
LOCAL = os.path.join(os.path.dirname(__file__), "publish")
DEPLOY = os.path.dirname(__file__)


def ensure(sftp, path: str):
    parts = path.strip("/").split("/")
    cur = ""
    for part in parts:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except OSError:
            sftp.mkdir(cur)


def upload_dir(sftp, local_dir: str, remote_dir: str):
    ensure(sftp, remote_dir)
    for root, _, files in os.walk(local_dir):
        rel = os.path.relpath(root, local_dir).replace("\\", "/")
        remote_root = remote_dir if rel == "." else f"{remote_dir}/{rel}"
        ensure(sftp, remote_root)
        for name in files:
            local_file = os.path.join(root, name)
            remote_file = f"{remote_root}/{name}"
            print(f"  upload {remote_file}")
            sftp.put(local_file, remote_file)


def upload_text(sftp, local_file: str, remote_file: str):
    ensure(sftp, os.path.dirname(remote_file))
    with open(local_file, "rb") as f:
        data = f.read().replace(b"\r\n", b"\n")
    with sftp.open(remote_file, "wb") as rf:
        rf.write(data)
    print(f"  upload {remote_file}")


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, 22, USER, PASSWORD, timeout=30)
    sftp = ssh.open_sftp()

    print("\n=== Upload web dist ===")
    upload_dir(sftp, os.path.join(LOCAL, "web"), f"{REMOTE}/web")

    for name in ("package.json", "package-lock.json"):
        upload_text(sftp, os.path.join(LOCAL, name), f"{REMOTE}/{name}")

    for name in ("start-node.mjs", "Dockerfile.web", "start-docker.sh"):
        upload_text(sftp, os.path.join(DEPLOY, name), f"{REMOTE}/deploy/{name}")

    sftp.chmod(
        f"{REMOTE}/deploy/start-docker.sh",
        stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH,
    )
    sftp.close()

    print("\n=== Restart containers ===")
    _, stdout, stderr = ssh.exec_command(f"bash {REMOTE}/deploy/start-docker.sh", timeout=600)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(err, file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    ssh.close()
    sys.exit(code)


if __name__ == "__main__":
    main()
