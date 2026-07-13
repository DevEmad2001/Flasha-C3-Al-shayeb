"""Start Docker containers on server (upload already done)."""
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


def run_ssh(ssh, cmd, timeout=600):
    print(f"\n$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return code


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, 22, USER, PASSWORD, timeout=30)

    sftp = ssh.open_sftp()
    with open(os.path.join(os.path.dirname(__file__), "start-docker.sh"), "rb") as f:
        content = f.read().replace(b"\r\n", b"\n")
    remote = f"{REMOTE_BASE}/deploy/start-docker.sh"
    with sftp.open(remote, "wb") as rf:
        rf.write(content)
    sftp.chmod(remote, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
    sftp.close()

    code = run_ssh(ssh, f"bash {remote}", timeout=600)
    if code != 0:
        run_ssh(ssh, "docker logs alshaib-api --tail 50 2>&1 || true")
        run_ssh(ssh, "docker logs alshaib-web --tail 50 2>&1 || true")
        ssh.close()
        sys.exit(1)

    print("\n=== Verify mq/flasha still running ===")
    run_ssh(ssh, "docker ps --filter name=mq --format '{{.Names}} {{.Status}}'")
    run_ssh(ssh, "docker ps --filter name=flasha --format '{{.Names}} {{.Status}}'")

    print("\n=== Try nginx + SSL as root ===")
    try:
        root = paramiko.SSHClient()
        root.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        root.connect(HOST, 22, "root", PASSWORD, timeout=15)
        run_ssh(root, f"bash {REMOTE_BASE}/deploy/install-alshaib-domain-root.sh", timeout=180)
        root.close()
    except Exception as exc:
        print(f"Root access failed: {exc}")

    ssh.close()


if __name__ == "__main__":
    main()
