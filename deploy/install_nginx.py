import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "194.163.157.119")
USER = os.environ.get("DEPLOY_USER", "adminftp")
PASSWORD = os.environ.get("DEPLOY_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set DEPLOY_PASSWORD env var before running this script.")

REMOTE = "/home/adminftp/AlShaibHousing"
DEPLOY_DIR = os.path.dirname(__file__)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, 22, USER, PASSWORD, timeout=30)

# Fix install script line endings and try sudo with password
with ssh.open_sftp() as sftp:
    with open(os.path.join(DEPLOY_DIR, "install-alshaib-domain-root.sh"), "rb") as f:
        content = f.read().replace(b"\r\n", b"\n")
    with sftp.open(f"{REMOTE}/deploy/install-alshaib-domain-root.sh", "wb") as rf:
        rf.write(content)
    with open(os.path.join(DEPLOY_DIR, "nginx-alshaib-turbo-erp.conf"), "rb") as f:
        content = f.read().replace(b"\r\n", b"\n")
    with sftp.open(f"{REMOTE}/deploy/nginx-alshaib-turbo-erp.conf", "wb") as rf:
        rf.write(content)

escaped = PASSWORD.replace("'", "'\\''")
cmd = f"echo '{escaped}' | sudo -S bash {REMOTE}/deploy/install-alshaib-domain-root.sh 2>&1"
print("$ sudo install nginx...")
_, o, e = ssh.exec_command(cmd, timeout=180)
print(o.read().decode())
print(e.read().decode())

cmds = [
    "sudo nginx -t 2>&1",
    "sudo systemctl reload nginx 2>&1 || sudo service nginx reload 2>&1",
    "curl -sI http://alshaib.turbo-erp.com/ | head -5",
]
for c in cmds:
    print(f"$ {c}")
    _, o, e = ssh.exec_command(c, timeout=60)
    print(o.read().decode())
    print(e.read().decode())

ssh.close()
print("Done.")
