#!/usr/bin/env python3
"""Native launcher: serves the built UI and opens a matte-black WebKit window."""

from __future__ import annotations

import os
import signal
import socket
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gtk, WebKit2, GLib  # noqa: E402

INSTALLED_ROOT = Path("/usr/share/quran-hadith-reader")


def resolve_root() -> Path:
    here = Path(__file__).resolve().parent
    for candidate in (here, INSTALLED_ROOT):
        if (candidate / "dist" / "index.html").is_file():
            return candidate
    return here


ROOT = resolve_root()
DIST = ROOT / "dist"
ICON = ROOT / "assets" / "app-icon.png"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def ensure_dist() -> None:
    if (DIST / "index.html").is_file() and (DIST / "data" / "quran" / "arabic.json").is_file():
        return
    if ROOT == INSTALLED_ROOT:
        sys.exit("Installed app data is missing under /usr/share/quran-hadith-reader/dist")
    print("Building app assets…", flush=True)
    import subprocess

    subprocess.check_call(["npm", "run", "build"], cwd=ROOT)
    if not (DIST / "index.html").is_file():
        sys.exit("Build failed: dist/index.html missing")


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, format, *args):  # noqa: A003
        return


def start_server(port: int) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def on_destroy(_win, server: ThreadingHTTPServer):
    server.shutdown()
    Gtk.main_quit()


def main() -> None:
    global ROOT, DIST, ICON
    ROOT = resolve_root()
    DIST = ROOT / "dist"
    ICON = ROOT / "assets" / "app-icon.png"

    ensure_dist()
    port = find_free_port()
    server = start_server(port)

    win = Gtk.Window(title="Quran & Hadith Reader")
    win.set_default_size(1100, 760)
    win.set_position(Gtk.WindowPosition.CENTER)
    if ICON.is_file():
        try:
            win.set_icon_from_file(str(ICON))
        except Exception:
            pass

    settings = WebKit2.Settings()
    settings.set_enable_developer_extras(False)
    settings.set_allow_file_access_from_file_urls(True)
    settings.set_allow_universal_access_from_file_urls(True)

    view = WebKit2.WebView()
    view.set_settings(settings)
    view.load_uri(f"http://127.0.0.1:{port}/")

    win.add(view)
    win.connect("destroy", partial(on_destroy, server=server))
    win.show_all()

    signal.signal(signal.SIGINT, lambda *_: GLib.idle_add(win.destroy))
    Gtk.main()


if __name__ == "__main__":
    os.chdir(ROOT if ROOT.exists() else Path.cwd())
    main()
