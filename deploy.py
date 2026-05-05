"""
Deploy script — uploads all website files to ManilaHost via FTPS (TLS).
Usage:  $env:FTP_PASS="..."; python deploy.py
"""
import ftplib
import os
import ssl
import sys

# ── CONFIG (override via environment variables) ────────────────────
FTP_HOST = os.environ.get("FTP_HOST", "ftp.topshelfsolartech.com")
FTP_USER = os.environ.get("FTP_USER", "rushmedz")
FTP_PASS = os.environ.get("FTP_PASS", "")
REMOTE_DIR = os.environ.get("REMOTE_DIR", "/public_html/solar")
USE_TLS = os.environ.get("USE_TLS", "1") == "1"
# ───────────────────────────────────────────────────────────────────

SKIP_FILES = {"server.py", "deploy.py", ".DS_Store", "Thumbs.db",
              "patch_css.php", "patch_css_b64.txt", "responsive_b64.txt",
              "showroom_b64.txt", "site.zip"}
SKIP_DIRS = {".git", ".vscode", "__pycache__", ".idea"}

LOCAL_ROOT = os.path.dirname(os.path.abspath(__file__))


def ensure_remote_dir(ftp, path):
    parts = [p for p in path.split("/") if p]
    cur = ""
    for p in parts:
        cur = f"{cur}/{p}"
        try:
            ftp.mkd(cur)
        except ftplib.error_perm:
            pass


def upload_dir(ftp, local_path, remote_path):
    ensure_remote_dir(ftp, remote_path)
    for item in sorted(os.listdir(local_path)):
        local_item = os.path.join(local_path, item)
        remote_item = f"{remote_path}/{item}"

        if os.path.isdir(local_item):
            if item in SKIP_DIRS:
                continue
            upload_dir(ftp, local_item, remote_item)
        elif os.path.isfile(local_item) and item not in SKIP_FILES:
            try:
                with open(local_item, "rb") as f:
                    ftp.storbinary(f"STOR {remote_item}", f)
                size = os.path.getsize(local_item)
                print(f"  OK  {remote_item}  ({size:,} bytes)")
            except Exception as e:
                print(f"  ERR {remote_item}: {e}")


def connect():
    print(f"Connecting to {FTP_HOST} ({'FTPS' if USE_TLS else 'FTP'})...")
    try:
        if USE_TLS:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            ftp = ftplib.FTP_TLS(context=ctx)
            ftp.connect(FTP_HOST, 21, timeout=30)
            ftp.login(FTP_USER, FTP_PASS)
            ftp.prot_p()
        else:
            raise Exception('Force plain FTP fallback')
        ftp.set_pasv(True)
        return ftp
    except Exception as e:
        print(f"FTPS failed ({e}), retrying with plain FTP...")
        ftp = ftplib.FTP()
        ftp.connect(FTP_HOST, 21, timeout=30)
        ftp.login(FTP_USER, FTP_PASS)
        ftp.set_pasv(True)
        return ftp


def main():
    if not FTP_PASS:
        print("ERROR: FTP_PASS environment variable not set.")
        sys.exit(1)
    try:
        with connect() as ftp:
            print(f"Connected as {FTP_USER}. Target: {REMOTE_DIR}\n")
            upload_dir(ftp, LOCAL_ROOT, REMOTE_DIR)
        print("\nDeployment complete.")
    except ftplib.all_errors as e:
        print(f"\nFTP error: {e}")
        sys.exit(2)


if __name__ == "__main__":
    main()
