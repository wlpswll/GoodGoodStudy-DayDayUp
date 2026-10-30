#!/usr/bin/env python3
"""带 Range 的本地静态服务。

系统自带的 `python3 -m http.server`（3.9）会忽略 Range，
浏览器就无法把视频进度拖到还没连续下载到的位置，刷新后也记不住时间。

在仓库根目录运行：

    python3 english/scripts/serve.py

然后打开 http://127.0.0.1:8765/english/
"""

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RangeHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        path = self.path.split("?", 1)[0]
        if path.endswith((".html", ".js", ".css")) or path.endswith("/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        range_header = self.headers.get("Range")
        if not range_header:
            super().do_GET()
            return
        path = Path(self.translate_path(self.path))
        if not path.is_file():
            super().do_GET()
            return
        self._send_range(path, range_header)

    def _send_range(self, path, range_header):
        size = path.stat().st_size
        spec = range_header.split("=", 1)[-1].split(",", 1)[0].strip()
        if not range_header.startswith("bytes=") or "-" not in spec:
            self.send_error(416, "Invalid range")
            return
        start_text, end_text = spec.split("-", 1)
        try:
            if start_text == "":
                length = int(end_text)
                start = max(0, size - length)
                end = size - 1
            else:
                start = int(start_text)
                end = int(end_text) if end_text else size - 1
        except ValueError:
            self.send_error(416, "Invalid range")
            return
        if start < 0 or start >= size or end < start:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return
        end = min(end, size - 1)
        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(length))
        self.end_headers()
        try:
            with path.open("rb") as handle:
                handle.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = handle.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            return


def main():
    parser = argparse.ArgumentParser(description="提供 english 页面，并支持视频拖动进度")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), RangeHandler)
    print("serving %s at http://%s:%s/english/" % (ROOT, args.host, args.port))
    server.serve_forever()


if __name__ == "__main__":
    main()
