"""Clear all business data; keep admin user and category lists."""
import json
import os
import sys
import urllib.error
import urllib.request

API = os.environ.get("API_URL", "http://localhost:5200/api").rstrip("/")
USER = os.environ.get("ADMIN_USER", "admin")
PASS = os.environ.get("ADMIN_PASS", "Admin@123")


def post(path: str, token: str | None = None, body: dict | None = None):
    data = json.dumps(body or {}).encode("utf-8")
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode("utf-8"))


def login() -> str:
    payload = post("/auth/login", body={"username": USER, "password": PASS})
    return payload["token"]


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"API: {API}")
    try:
        token = login()
        print("Logged in as admin.")
        result = post("/admin/data/clear", token=token)
        print(result.get("message", result))
        counts = result.get("counts", {})
        for key, val in sorted(counts.items()):
            print(f"  {key}: {val}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection failed: {e.reason}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
