import os,ssl,ftplib,time
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
for attempt in range(8):
    try:
        f=ftplib.FTP_TLS('ftp.topshelfsolartech.com',context=ctx,timeout=180)
        f.login('rushmedz',os.environ['FTP_PASS']); f.prot_p(); f.set_pasv(True)
        for l,r in [('admin.html','admin.html'),('js/admin.js','js/admin.js')]:
            print('OK',r,os.path.getsize(l),'B'); f.storbinary('STOR /topshelfsolartech.com/'+r, open(l,'rb'))
        print('Done.'); f.quit(); break
    except Exception as e:
        print('attempt',attempt,'failed:',e); time.sleep(20)
