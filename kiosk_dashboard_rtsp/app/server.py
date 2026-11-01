#!/usr/bin/env python3
"""Dashboard RTSP — dodatek Home Assistant: streamuje wybrane dashboardy/widoki HA jako kamery RTSP.

Architektura (na dashboard): Xvfb (wirtualny ekran) -> Chromium w trybie kiosk, zalogowany
bezobsługowo przez wstrzyknięty do localStorage long-lived token (rozszerzenie Chromium
wykonujące się przy document_start, zanim HA samo wczyta sesję) -> ffmpeg (x11grab) koduje
ekran i publikuje (RTSP ANNOUNCE/RECORD) do lokalnego MediaMTX, który serwuje gotowy strumień
dalej, każdy klientom na porcie 8554 pod ścieżką /<id_dashboardu>.

Panel (Ingress) pozwala dodawać/edytować/usuwać dashboardy i ustawić adres HA + token.
"""
import json
import os
import re
import secrets
import shutil
import signal
import subprocess
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("KM_PORT", "8098"))
DATA = os.environ.get("KM_DATA", "/data")
CONF = os.path.join(DATA, "config.json")
RUN_DIR = "/tmp/dashboard-rtsp"
APP_DIR = os.path.dirname(os.path.abspath(__file__))
INGRESS_ONLY = os.environ.get("KM_ANY_CLIENT") != "1"
INGRESS_GW = "172.30.32.2"
MTX_RTSP_PORT = 8554
ID_RE = re.compile(r"^[a-z0-9]{1,20}$")
LOCK = threading.Lock()
ADDON_VERSION = "1.0.0"          # = version w config.yaml

CHROMIUM_BIN = shutil.which("chromium-browser") or shutil.which("chromium") or "/usr/bin/chromium-browser"


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)


def load():
    try:
        c = json.load(open(CONF))
    except Exception:
        c = {}
    c.setdefault("ha_url", "http://homeassistant:8123")
    c.setdefault("token", "")
    c.setdefault("dashboards", [])
    return c


def save(c):
    os.makedirs(DATA, exist_ok=True)
    tmp = CONF + ".tmp"
    with open(tmp, "w") as f:
        json.dump(c, f, ensure_ascii=False, indent=1)
    os.replace(tmp, CONF)


def to_int(v, lo, hi, default):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


# ---------------------------------------------------------------- nadzór nad strumieniami

WORKERS = {}      # id -> Worker
WORKERS_LOCK = threading.Lock()


class Worker:
    """Jeden dashboard = jeden wątek pilnujący trójki procesów: Xvfb, Chromium, ffmpeg.
    Jeśli którykolwiek padnie, wątek po chwili odpala całą trójkę od nowa (prościej i pewniej
    niż osobne odtwarzanie samego ffmpeg albo samego Chromium, które mogłyby się rozjechać)."""

    def __init__(self, d, display):
        self.id = d["id"]
        self.display = display
        self.stop_flag = threading.Event()
        self.log_lines = []
        self.status = "start…"
        self.procs = []
        self.thread = threading.Thread(target=self._run, args=(dict(d),), daemon=True)
        self.thread.start()

    def _log(self, msg):
        self.log_lines.append(time.strftime("%H:%M:%S ") + msg)
        del self.log_lines[:-300]
        log("[%s] %s" % (self.id, msg))

    def update(self, d):
        self.pending = dict(d)

    def stop(self):
        self.stop_flag.set()
        self._kill_all()

    def _kill_all(self):
        for p in self.procs:
            try:
                p.terminate()
            except Exception:
                pass
        for p in self.procs:
            try:
                p.wait(timeout=5)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        self.procs = []

    def _ext_dir(self, ha_url, token):
        d = os.path.join(RUN_DIR, "ext-" + self.id)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d, exist_ok=True)
        origin = "%s://%s/*" % (urllib.parse.urlsplit(ha_url).scheme, urllib.parse.urlsplit(ha_url).netloc)
        manifest = {"manifest_version": 3, "name": "token-inject", "version": "1.0",
                    "content_scripts": [{"matches": [origin], "js": ["content.js"], "run_at": "document_start",
                                          "all_frames": False}]}
        with open(os.path.join(d, "manifest.json"), "w") as f:
            json.dump(manifest, f)
        tok = json.dumps({"access_token": token, "token_type": "Bearer", "expires_in": 1800,
                           "hass_url": ha_url, "clientId": ha_url})
        with open(os.path.join(d, "content.js"), "w") as f:
            f.write("try{localStorage.setItem('hassTokens', JSON.stringify(%s));"
                    "localStorage.setItem('selectedLanguage', JSON.stringify(\"pl\"));}catch(e){}" % tok)
        return d

    def _start_all(self, d):
        w, h = to_int(d.get("width"), 320, 3840, 1920), to_int(d.get("height"), 240, 2160, 1080)
        fps = to_int(d.get("fps"), 1, 30, 6)
        ha_url = (d.get("ha_url") or "").rstrip("/")
        token = d.get("token") or ""
        path = d.get("path") or "/"
        if not path.startswith("/"):
            path = "/" + path
        url = ha_url + path

        xvfb = subprocess.Popen(["Xvfb", ":%d" % self.display, "-screen", "0", "%dx%dx24" % (w, h),
                                  "-nolisten", "tcp"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.procs.append(xvfb)
        t0 = time.time()
        while not os.path.exists("/tmp/.X11-unix/X%d" % self.display):
            if time.time() - t0 > 15 or xvfb.poll() is not None:
                raise RuntimeError("Xvfb nie wystartował (display :%d)" % self.display)
            time.sleep(0.2)

        ext = self._ext_dir(ha_url, token) if token else None
        env = dict(os.environ, DISPLAY=":%d" % self.display)
        prof = os.path.join(RUN_DIR, "profile-" + self.id)
        shutil.rmtree(prof, ignore_errors=True)
        args = [CHROMIUM_BIN, "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
                "--disable-software-rasterizer", "--window-size=%d,%d" % (w, h), "--window-position=0,0",
                "--kiosk", "--noerrdialogs", "--disable-infobars", "--no-first-run",
                "--disable-session-crashed-bubble", "--autoplay-policy=no-user-gesture-required",
                "--user-data-dir=" + prof]
        if ext:
            args += ["--load-extension=" + ext, "--disable-extensions-except=" + ext]
        args.append(url)
        chromium = subprocess.Popen(args, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.procs.append(chromium)
        time.sleep(3)   # chwila na start Chromium i załadowanie dashboardu, zanim ffmpeg zacznie chwytać ekran

        ff = subprocess.Popen(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-f", "x11grab", "-video_size", "%dx%d" % (w, h),
             "-framerate", str(fps), "-i", ":%d" % self.display, "-c:v", "libx264", "-preset", "ultrafast",
             "-tune", "zerolatency", "-pix_fmt", "yuv420p", "-g", str(fps * 2), "-f", "rtsp",
             "rtsp://127.0.0.1:%d/%s" % (MTX_RTSP_PORT, self.id)],
            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        self.procs.append(ff)
        return xvfb, chromium, ff

    def _run(self, d):
        self.pending = None
        backoff = 2
        while not self.stop_flag.is_set():
            cur = self.pending if self.pending is not None else d
            self.pending = None
            try:
                self._log("start (display :%d, %sx%s@%sfps)" % (self.display, cur.get("width"), cur.get("height"),
                                                                   cur.get("fps")))
                self.status = "działa"
                xvfb, chromium, ff = self._start_all(cur)
                backoff = 2
                while not self.stop_flag.is_set() and self.pending is None:
                    if xvfb.poll() is not None or chromium.poll() is not None or ff.poll() is not None:
                        err = b""
                        try:
                            err = ff.stderr.read(2000) if ff.stderr else b""
                        except Exception:
                            pass
                        self._log("proces padł, restart za %ds (%s)" % (backoff, err.decode(errors="replace")[:300]))
                        break
                    time.sleep(1)
            except Exception as e:
                self._log("błąd: %r — restart za %ds" % (e, backoff))
                self.status = "błąd — próbuję ponownie"
            self._kill_all()
            if self.stop_flag.is_set():
                break
            if self.pending is not None:
                continue
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)
        self.status = "zatrzymany"


def reconcile():
    """Dopasowuje działające wątki (WORKERS) do configu: dodaje nowe, usuwa skasowane,
    aktualizuje zmienione (zmiana parametrów = pełny restart trójki procesów)."""
    c = load()
    with WORKERS_LOCK:
        wanted = {d["id"]: dict(d, ha_url=c["ha_url"], token=c["token"]) for d in c["dashboards"]}
        for wid in list(WORKERS):
            if wid not in wanted:
                WORKERS.pop(wid).stop()
        used_displays = {w.display for w in WORKERS.values()}
        nxt = 101
        for wid, d in wanted.items():
            if wid in WORKERS:
                WORKERS[wid].update(d)
            else:
                while nxt in used_displays:
                    nxt += 1
                used_displays.add(nxt)
                WORKERS[wid] = Worker(d, nxt)
                nxt += 1


MTX_PROC = {"p": None}


def mediamtx_loop():
    while True:
        p = subprocess.Popen(["/usr/local/bin/mediamtx", "/app/mediamtx.yml"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        MTX_PROC["p"] = p
        log("MediaMTX uruchomiony (pid %d)" % p.pid)
        p.wait()
        log("MediaMTX padł, restart za 3 s")
        time.sleep(3)


# ---------------------------------------------------------------- panel (Ingress)

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "dashboard-rtsp"

    def log_message(self, fmt, *args):
        if os.environ.get("KM_DEBUG"):
            log("%s %s" % (self.client_address[0], fmt % args))

    def allowed(self):
        ip = self.client_address[0]
        return not INGRESS_ONLY or ip in (INGRESS_GW, "127.0.0.1", "::1")

    def send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def body_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw or b"{}")
        except ValueError:
            raise ValueError("błędny JSON")

    def route(self):
        try:
            self._route()
        except KeyError:
            self.send(404, {"error": "nie ma takiego dashboardu"})
        except (ValueError, RuntimeError) as e:
            self.send(400, {"error": str(e)})
        except Exception as e:
            log("błąd %s %s: %r" % (self.command, self.path, e))
            self.send(500, {"error": str(e)})

    def _route(self):
        if not self.allowed():
            return self.send(403, {"error": "tylko przez Home Assistant (Ingress)"})
        path = self.path.split("?", 1)[0]
        if self.command == "GET" and path in ("/", "/index.html"):
            with open(os.path.join(APP_DIR, "index.html"), "rb") as f:
                return self.send(200, f.read(), "text/html; charset=utf-8")
        if self.command == "GET" and path == "/api/config":
            c = load()
            return self.send(200, {"ha_url": c["ha_url"], "token_set": bool(c["token"]),
                                    "dashboards": c["dashboards"], "mtx_port": MTX_RTSP_PORT,
                                    "version": ADDON_VERSION})
        if self.command == "POST" and path == "/api/settings":
            b = self.body_json()
            c = load()
            if "ha_url" in b:
                c["ha_url"] = str(b["ha_url"]).rstrip("/") or "http://homeassistant:8123"
            if "token" in b and b["token"]:
                c["token"] = str(b["token"])
            save(c)
            reconcile()
            return self.send(200, {"ok": True})
        if self.command == "GET" and path == "/api/status":
            with WORKERS_LOCK:
                return self.send(200, {wid: {"status": w.status, "display": w.display} for wid, w in WORKERS.items()})
        if self.command == "GET" and path.startswith("/api/log/"):
            wid = path[9:]
            with WORKERS_LOCK:
                w = WORKERS.get(wid)
            if not w:
                raise KeyError(wid)
            return self.send(200, "\n".join(w.log_lines[-200:]), "text/plain; charset=utf-8")
        if self.command == "POST" and path == "/api/dashboards":
            b = self.body_json()
            name = str(b.get("name", "")).strip()[:60] or "Dashboard"
            dpath = str(b.get("path", "/")).strip() or "/"
            if not name:
                raise ValueError("nazwa jest wymagana")
            c = load()
            if not c["token"]:
                raise ValueError("najpierw ustaw długoterminowy token Home Assistant (Ustawienia powyżej)")
            did = secrets.token_hex(4)
            c["dashboards"].append({"id": did, "name": name, "path": dpath,
                                     "width": to_int(b.get("width"), 320, 3840, 1920),
                                     "height": to_int(b.get("height"), 240, 2160, 1080),
                                     "fps": to_int(b.get("fps"), 1, 30, 6)})
            save(c)
            reconcile()
            return self.send(200, {"ok": True, "id": did})
        m = re.match(r"^/api/dashboards/([a-z0-9]{1,20})$", path)
        if self.command == "DELETE" and m:
            c = load()
            before = len(c["dashboards"])
            c["dashboards"] = [x for x in c["dashboards"] if x["id"] != m.group(1)]
            if len(c["dashboards"]) == before:
                raise KeyError(m.group(1))
            save(c)
            reconcile()
            return self.send(200, {"ok": True})
        mr = re.match(r"^/api/dashboards/([a-z0-9]{1,20})/restart$", path)
        if self.command == "POST" and mr:
            with WORKERS_LOCK:
                w = WORKERS.get(mr.group(1))
            if not w:
                raise KeyError(mr.group(1))
            w.update(dict(next(x for x in load()["dashboards"] if x["id"] == mr.group(1)),
                           ha_url=load()["ha_url"], token=load()["token"]))
            return self.send(200, {"ok": True})
        return self.send(404, {"error": "nie znaleziono"})

    do_GET = do_POST = do_DELETE = route


def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(RUN_DIR, exist_ok=True)
    threading.Thread(target=mediamtx_loop, daemon=True).start()
    time.sleep(1)
    reconcile()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    log("Dashboard RTSP: panel na porcie %d, RTSP na %d, dashboardów: %d" %
        (PORT, MTX_RTSP_PORT, len(load()["dashboards"])))
    srv.serve_forever()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *a: os._exit(0))
    main()
