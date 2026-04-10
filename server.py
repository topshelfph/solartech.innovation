"""Local dev server that serves extensionless URLs (e.g. /about -> about.html)"""
import http.server
import os

class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Strip query string for file lookup
        path = self.path.split('?')[0].split('#')[0]

        # If path has no extension and isn't a directory, try .html
        if '.' not in os.path.basename(path) and path != '/':
            html_path = path.rstrip('/') + '.html'
            local = self.translate_path(html_path)
            if os.path.isfile(local):
                self.path = html_path
        super().do_GET()

if __name__ == '__main__':
    PORT = 8080
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.HTTPServer(('', PORT), CleanURLHandler) as srv:
        print(f'Serving at http://localhost:{PORT}')
        srv.serve_forever()
