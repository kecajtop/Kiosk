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
ADDON_VERSION = "1.2.2"          # = version w config.yaml

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
        self.cur_w, self.cur_h = 1920, 1080  # aktualizowane w _start_all; czyta je /api/snapshot
        self.thread = threading.Thread(target=self._run, args=(dict(d),), daemon=True)
        self.thread.start()

    def _log(self, msg):
        self.log_lines.append(time.strftime("%H:%M:%S ") + msg)
        del self.log_lines[:-300]
        log("[%s] %s" % (self.id, msg))

    def _pump_chromium_log(self, chromium):
        try:
            for raw in iter(chromium.stderr.readline, b""):
                line = raw.decode(errors="replace").strip()
                # Chromium w kontenerze bez systemowego D-Busa/UPower generuje mnóstwo
                # kompletnie nieszkodliwego, normalnego szumu ("Failed to connect to the
                # bus", "NameHasOwner", GetAll na UPower) - pomijamy go, bo inaczej zalewa
                # log i zasłania to, co faktycznie pomaga zdiagnozować białą stronę/login.
                if not line or "dbus/" in line or "UPower" in line or "NameHasOwner" in line:
                    continue
                if "FATAL" in line or "Uncaught" in line or "net::ERR" in line or "Renderer process" in line:
                    self._log("chromium: " + line[:300])
        except Exception:
            pass

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
        # home-assistant-js-websocket (getAuth) akceptuje zapisany token TYLKO, gdy
        # data.hassUrl jest DOKŁADNIE równe żądanemu URL-owi (porównanie stringów) - inaczej
        # cichutko go ignoruje i przechodzi do prawdziwego logowania (OAuth redirect), bez
        # żadnego błędu w konsoli. Klucz MUSI się nazywać "hassUrl" (camelCase), nie
        # "hass_url" - to była pierwsza wersja tego pliku i właśnie dlatego token był
        # ignorowany. "expires" to bezwzględny czas (ms) wygaśnięcia - liczony w JS w
        # momencie wstrzyknięcia, nie z góry w Pythonie. "refresh_token" dla tokenu
        # długoterminowego to pusty string (pole wymagane, ale nieużywane bez odświeżania).
        tok = json.dumps({"hassUrl": ha_url, "clientId": None, "access_token": token,
                           "refresh_token": "", "expires_in": 1800})
        with open(os.path.join(d, "content.js"), "w") as f:
            f.write(
                "try{"
                "var t=%s; t.expires=Date.now()+t.expires_in*1000;"
                "localStorage.setItem('hassTokens', JSON.stringify(t));"
                "localStorage.setItem('selectedLanguage', JSON.stringify(\"pl\"));"
                "}catch(e){}" % tok)
        return d

    def _start_all(self, d):
        w, h = to_int(d.get("width"), 320, 3840, 1920), to_int(d.get("height"), 240, 2160, 1080)
        fps = to_int(d.get("fps"), 1, 30, 6)
        self.cur_w, self.cur_h = w, h
        ha_url = (d.get("ha_url") or "").rstrip("/")
        token = d.get("token") or ""
        path = d.get("path") or "/"
        if not path.startswith("/"):
            path = "/" + path
        url = ha_url + path

        # A previous Xvfb on this same display that was killed (not exited cleanly)
        # can leave its socket/lock behind. If so, the readiness check below would
        # see it as "ready" immediately — even though it belongs to the dead
        # instance, not the one just started — so a genuinely failed Xvfb would go
        # unnoticed and chromium/ffmpeg would be pointed at a dead display.
        for stale in ("/tmp/.X11-unix/X%d" % self.display, "/tmp/.X%d-lock" % self.display):
            try:
                os.remove(stale)
            except OSError:
                pass

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
                "--enable-logging=stderr", "--log-level=1", "--user-data-dir=" + prof]
        if ext:
            args += ["--load-extension=" + ext, "--disable-extensions-except=" + ext]
        args.append(url)
        chromium = subprocess.Popen(args, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        self.procs.append(chromium)
        # Chromium nigdy sam "nie pada" przy błędzie strony (złym tokenie, złej ścieżce,
        # błędzie JS) - proces żyje dalej, tylko pokazuje pustą/białą stronę. Bez czytania
        # jego stderr na żywo taki błąd był całkowicie niewidoczny w Logu strumienia.
        threading.Thread(target=self._pump_chromium_log, args=(chromium,), daemon=True).start()
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
                    dead = [name for name, p in (("xvfb", xvfb), ("chromium", chromium), ("ffmpeg", ff))
                            if p.poll() is not None]
                    if dead:
                        self.status = "błąd — próbuję ponownie"
                        # Stop whatever is still alive FIRST. If e.g. chromium died but
                        # ffmpeg is still running, ff.stderr is a live pipe that nothing
                        # has closed yet — reading from it below would block forever
                        # (ffmpeg logs nothing at -loglevel error while idle), freezing
                        # this thread and leaving the stream stuck instead of restarting.
                        self._kill_all()
                        err = b""
                        try:
                            err = ff.stderr.read(2000) if ff.stderr else b""
                        except Exception:
                            pass
                        self._log("proces padł (%s), restart za %ds (%s)" %
                                   (",".join(dead), backoff, err.decode(errors="replace")[:300]))
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

    def _read_body(self):
        """Proxy Ingress HA (zwłaszcza z ingress_stream: true) czasem przekazuje POST
        bez nagłówka Content-Length, tylko z Transfer-Encoding: chunked — wtedy samo
        czytanie self.rfile.read(Content-Length) dawało puste body (Content-Length=0),
        mimo że klient faktycznie wysłał dane. Trzeba samemu zdekodować chunked."""
        te = (self.headers.get("Transfer-Encoding") or "").lower()
        if "chunked" in te:
            chunks = []
            while True:
                size_line = self.rfile.readline().strip()
                if not size_line:
                    continue
                size = int(size_line.split(b";", 1)[0], 16)
                if size == 0:
                    self.rfile.readline()
                    break
                chunks.append(self.rfile.read(size))
                self.rfile.read(2)  # CRLF po danych chunku
            return b"".join(chunks)
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def body_json(self):
        raw = self._read_body()
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
            if not b:
                log("UWAGA: puste body w /api/settings (Content-Length=%r, Transfer-Encoding=%r)" %
                    (self.headers.get("Content-Length"), self.headers.get("Transfer-Encoding")))
            c = load()
            if "ha_url" in b:
                c["ha_url"] = str(b["ha_url"]).rstrip("/") or "http://homeassistant:8123"
            if "token" in b and b["token"]:
                c["token"] = str(b["token"]).strip()
            save(c)
            log("ustawienia zapisane: ha_url=%r, token=%s (%d znaków)" %
                (c["ha_url"], "ustawiony" if c["token"] else "BRAK", len(c["token"])))
            reconcile()
            return self.send(200, {"ok": True, "token_len": len(c["token"])})
        if self.command == "GET" and path == "/api/status":
            with WORKERS_LOCK:
                return self.send(200, {wid: {"status": w.status, "display": w.display} for wid, w in WORKERS.items()})
        ms = re.match(r"^/api/snapshot/([a-z0-9]{1,20})$", path)
        if self.command == "GET" and ms:
            with WORKERS_LOCK:
                w = WORKERS.get(ms.group(1))
            if not w:
                raise KeyError(ms.group(1))
            try:
                # Łapie jedną klatkę z tego samego ekranu X11, co ffmpeg->RTSP (x11grab
                # pozwala na wielu jednoczesnych czytelników tego samego displaya) - żywy
                # podgląd wprost w panelu, bez potrzeby odtwarzacza RTSP.
                p = subprocess.run(["ffmpeg", "-y", "-f", "x11grab", "-video_size", "%dx%d" % (w.cur_w, w.cur_h),
                                     "-i", ":%d" % w.display, "-frames:v", "1", "-f", "image2",
                                     "-vcodec", "mjpeg", "-"],
                                    capture_output=True, timeout=8)
                if not p.stdout:
                    raise RuntimeError((p.stderr or b"").decode(errors="replace")[:200] or "brak klatki")
                return self.send(200, p.stdout, "image/jpeg")
            except Exception as e:
                raise RuntimeError("podgląd niedostępny: %s" % e)
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
        if self.command == "PUT" and m:
            b = self.body_json()
            c = load()
            dash = next((x for x in c["dashboards"] if x["id"] == m.group(1)), None)
            if not dash:
                raise KeyError(m.group(1))
            if "name" in b:
                dash["name"] = str(b["name"]).strip()[:60] or dash["name"]
            if "path" in b:
                dash["path"] = str(b["path"]).strip() or "/"
            if "width" in b:
                dash["width"] = to_int(b.get("width"), 320, 3840, dash["width"])
            if "height" in b:
                dash["height"] = to_int(b.get("height"), 240, 2160, dash["height"])
            if "fps" in b:
                dash["fps"] = to_int(b.get("fps"), 1, 30, dash["fps"])
            save(c)
            reconcile()  # zmiana parametrów = pełny restart trójki procesów tego strumienia
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

    do_GET = do_POST = do_DELETE = do_PUT = route


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
