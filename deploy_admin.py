"""Deploy only the admin files to /public_html root."""
import ftplib, os, ssl, sys

FTP_HOST = "ftp.topshelfsolartech.com"
FTP_USER = "rushmedz"
FTP_PASS = os.environ.get("FTP_PASS", "")
REMOTE_DIR = "/public_html"

FILES = [
    ("admin.html", "admin.html"),
    ("css/admin.css", "css/admin.css"),
    ("js/admin.js", "js/admin.js"),
]

LOCAL_ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    if not FTP_PASS:
        print("ERROR: FTP_PASS not set"); sys.exit(1)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ftp = ftplib.FTP_TLS(context=ctx)
    ftp.connect(FTP_HOST, 21, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.prot_p()
    ftp.set_pasv(True)
    print(f"Connected. Uploading admin files to {REMOTE_DIR}\n")

    for local, remote in FILES:
        lp = os.path.join(LOCAL_ROOT, local.replace("/", os.sep))
        rp = f"{REMOTE_DIR}/{remote}"
        # ensure dir
        d = os.path.dirname(rp)
        if d and d != REMOTE_DIR:
            try: ftp.mkd(d)
            except ftplib.error_perm: pass
        with open(lp, "rb") as f:
            ftp.storbinary(f"STOR {rp}", f)
        print(f"  OK  {rp}  ({os.path.getsize(lp):,} bytes)")

    ftp.quit()
    print("\nDone. Visit https://topshelfsolartech.com/admin")


if __name__ == "__main__":
    main()
