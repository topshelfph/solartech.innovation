import ftplib
import os
import ssl

# Minimal deploy script: uploads only critical files for admin console
FTP_HOST = os.environ.get("FTP_HOST", "ftp.topshelfsolartech.com")
FTP_USER = os.environ.get("FTP_USER", "rushmedz")
FTP_PASS = os.environ.get("FTP_PASS", "")
REMOTE_DIR = os.environ.get("REMOTE_DIR", "/public_html/solar")
USE_TLS = os.environ.get("USE_TLS", "1") == "1"

FILES_TO_UPLOAD = [
    ("admin.html", f"{REMOTE_DIR}/admin.html"),
    ("js/admin.js", f"{REMOTE_DIR}/js/admin.js"),
]


def upload_file(ftp, local_path, remote_path):
    with open(local_path, "rb") as f:
        ftp.storbinary(f"STOR {remote_path}", f)
    size = os.path.getsize(local_path)
    print(f"  OK  {remote_path}  ({size:,} bytes)")


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
        return
    try:
        with connect() as ftp:
            print(f"Connected as {FTP_USER}. Target: {REMOTE_DIR}\n")
            for local, remote in FILES_TO_UPLOAD:
                upload_file(ftp, local, remote)
        print("\nMinimal deployment complete.")
    except ftplib.all_errors as e:
        print(f"\nFTP error: {e}")


if __name__ == "__main__":
    main()
