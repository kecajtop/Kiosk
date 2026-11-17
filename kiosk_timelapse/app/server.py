#!/usr/bin/env python3
"""Timelapse RTSP — dodatek Home Assistant: nagrywa poklatkowe filmy (timelapse) z dowolnych
strumieni RTSP (kamer IP, NVR, albo np. strumieni z dodatku Dashboard RTSP) według harmonogramu.

Architektura (na timelapse): wątek nadzorujący łapie jedną klatkę JPEG ze strumienia RTSP co
skonfigurowany interwał (ffmpeg, jednorazowe połączenie -rtsp_transport tcp, bez trzymania
strumienia otwartego cały czas). O ustalonej godzinie (albo na żądanie z panelu) wszystkie
nowe klatki od ostatniego renderu są składane w jeden plik mp4 (ffmpeg, concat demuxer).
Renderowanie całego dodatku jest serializowane (jeden render na raz) i odpalane przez `nice`
z niskim priorytetem CPU — tak, żeby prędkość renderowania naturalnie zależała od obciążenia
komputera: na zajętej maszynie (np. gdy jednocześnie pracuje dużo kiosków/strumieni) jądro
odda CPU innym procesom i render po prostu potrwa dłużej, a na wolnej maszynie przebiegnie
szybko — bez twardego, sztywnego limitu, który i tak trzeba by było zgadywać.

Panel (Ingress) pozwala dodawać/edytować/usuwać timelapse'y, podglądać ostatnią klatkę i log,
wymuszać przechwycenie/render od ręki oraz przeglądać/pobierać/usuwać gotowe pliki mp4.
"""
import json
import os
import queue
import re
import secrets
import shutil
import signal
import subprocess
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("TL_PORT", "8097"))
DATA = os.environ.get("TL_DATA", "/data")
CONF = os.path.join(DATA, "config.json")
FRAMES_DIR = os.path.join(DATA, "frames")
VIDEOS_DIR = os.path.join(DATA, "videos")
MEDIA_DIR = "/media/timelapse_rtsp"   # kopia gotowych filmów, jeśli /media jest zamapowane (wygodny podgląd w HA)
RUN_DIR = "/tmp/timelapse-rtsp"
APP_DIR = os.path.dirname(os.path.abspath(__file__))
INGRESS_ONLY = os.environ.get("TL_ANY_CLIENT") != "1"
INGRESS_GW = "172.30.32.2"
ID_RE = re.compile(r"^[a-z0-9]{1,20}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
FILE_RE = re.compile(r"^[A-Za-z0-9_.-]{1,120}$")
ADDON_VERSION = "1.0.0"          # = version w config.yaml

NICE_BIN = shutil.which("nice")


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)


def load():
    try:
        c = json.load(open(CONF))
    except Exception:
        c = {}
    c.setdefault("timelapses", [])
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


def to_fps(v, default):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return default
    if n != n:  # NaN
        return default
    return max(1, min(60, n))


def to_time(v, default):
    v = str(v or "").strip()
    return v if TIME_RE.match(v) else default


def scrub_creds(text, url):
    """Nie wklejaj danych logowania z adresu RTSP do logu widocznego w panelu — ffmpeg czasem
    odwzorowuje cały podany URL w komunikacie błędu (np. przy złym adresie/odmowie dostępu)."""
    try:
        u = urllib.parse.urlsplit(url)
        if u.username or u.password:
            safe_host = u.hostname + (":%d" % u.port if u.port else "")
            safe = urllib.parse.urlunsplit((u.scheme, safe_host, u.path, u.query, u.fragment))
            text = text.replace(url, safe)
            if u.password:
                text = text.replace(u.password, "***")
    except Exception:
        pass
    return text


# -------------------------------------------------------------- stan w pamięci (log/status)

RUNTIME = {}   # id -> {"log": [...], "status": str, "last_capture_ts": int, "rendering": bool}
RUNTIME_LOCK = threading.Lock()


def _rt_entry(tid):
    return RUNTIME.setdefault(tid, {"log": [], "status": "?", "last_capture_ts": 0, "rendering": False})


def rt_get(tid):
    with RUNTIME_LOCK:
        return dict(_rt_entry(tid))


def rt_set(tid, **kw):
    with RUNTIME_LOCK:
        _rt_entry(tid).update(kw)


def rt_log(tid, msg):
    with RUNTIME_LOCK:
        r = _rt_entry(tid)
        r["log"].append(time.strftime("%H:%M:%S ") + msg)
        del r["log"][:-300]
    log("[%s] %s" % (tid, msg))


# ---------------------------------------------------------------------- przechwytywanie klatek

def _ffmpeg_err(stderr_bytes):
    """ffmpeg zawsze najpierw wypisuje na stderr baner wersji/bibliotek (kilka-kilkanaście
    linii) i tylko na końcu, jeśli coś pójdzie nie tak, faktyczny błąd - a czasem wywala się
    jeszcze PRZED napisaniem błędu, więc goły '[-300:]' bajtów bez filtrowania czasem łapał
    tylko ogon banera. Zamiast tego: zostaw tylko linie, które faktycznie wyglądają na błąd."""
    text = (stderr_bytes or b"").decode(errors="replace")
    keep = [ln.strip() for ln in text.splitlines()
            if ln.strip() and any(k in ln for k in
                ("Error", "error", "refused", "Refused", "timed out", "Timeout",
                 "Unauthorized", "401", "404", "Invalid", "No route", "not found"))]
    return "; ".join(keep[-5:]) if keep else text.strip()[-200:]


def capture_frame(rtsp_url, out_path, timeout=15, transport="tcp"):
    """Łapie jedną klatkę JPEG ze strumienia RTSP - osobne, krótkie połączenie na każdą klatkę
    (nie trzyma strumienia otwartego cały czas), co jest proste i odporne na typowe
    rozłączenia RTSP między kolejnymi przechwyceniami (zwykle raz na kilka minut, nie ma więc
    znaczenia czas 1-2 s samego nawiązania połączenia)."""
    tmp = out_path + ".tmp"
    try:
        p = subprocess.run(
            ["ffmpeg", "-y", "-rtsp_transport", transport, "-i", rtsp_url,
             "-frames:v", "1", "-q:v", "3", tmp],
            capture_output=True, timeout=timeout)
        if p.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) == 0:
            raise RuntimeError(_ffmpeg_err(p.stderr) or "brak klatki")
        os.replace(tmp, out_path)
    except subprocess.TimeoutExpired:
        raise RuntimeError("przekroczony czas połączenia RTSP (%ds)" % timeout)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def capture_once(tid, t):
    fdir = os.path.join(FRAMES_DIR, tid)
    os.makedirs(fdir, exist_ok=True)
    ts = int(time.time())
    path = os.path.join(fdir, "%010d.jpg" % ts)
    try:
        capture_frame(t["rtsp_url"], path, transport=t.get("transport", "tcp"))
        rt_set(tid, status="działa", last_capture_ts=ts)
    except Exception as e:
        rt_set(tid, status="błąd przechwytywania")
        rt_log(tid, "przechwytywanie klatki nie powiodło się: %s" % scrub_creds(str(e), t.get("rtsp_url", "")))


# --------------------------------------------------------------------------- renderowanie

RENDER_QUEUE = queue.Queue()
RENDER_LOCK = threading.Lock()   # tylko jeden render na raz w całym dodatku (patrz docstring modułu)


def enqueue_render(tid, reason):
    RENDER_QUEUE.put((tid, reason))


def _niced(cmd):
    """Renderowanie wideo to jedyna naprawdę ciężka operacja CPU w tym dodatku (przechwytywanie
    pojedynczych klatek jest znikome). `nice` oddaje CPU innym procesom, kiedy maszyna jest
    zajęta, więc render po prostu zwalnia pod obciążeniem i przyspiesza, gdy jest wolny CPU —
    bez potrzeby zgadywania jakiegoś sztywnego limitu prędkości/CPU."""
    return ([NICE_BIN, "-n", "15"] + cmd) if NICE_BIN else cmd


def render_worker_loop():
    while True:
        tid, reason = RENDER_QUEUE.get()
        try:
            do_render(tid, reason)
        except Exception as e:
            rt_log(tid, "renderowanie nie powiodło się: %r" % e)
            rt_set(tid, rendering=False)


def do_render(tid, reason):
    c = load()
    t = next((x for x in c["timelapses"] if x["id"] == tid), None)
    if not t:
        return
    fdir = os.path.join(FRAMES_DIR, tid)
    last_ts = int(t.get("last_rendered_ts") or 0)
    now_ts = int(time.time())
    try:
        names = sorted(n for n in os.listdir(fdir) if n.endswith(".jpg"))
    except OSError:
        names = []
    frames = []
    for n in names:
        try:
            ts = int(n[:-4])
        except ValueError:
            continue
        if last_ts < ts <= now_ts:
            frames.append(n)
    if not frames:
        rt_log(tid, "renderowanie (%s): brak nowych klatek od ostatniego renderu" % reason)
        return

    rt_set(tid, rendering=True)
    rt_log(tid, "renderowanie (%s): %d nowych klatek" % (reason, len(frames)))
    try:
        vdir = os.path.join(VIDEOS_DIR, tid)
        os.makedirs(vdir, exist_ok=True)
        render_fps = to_fps(t.get("render_fps"), 24)
        dur = 1.0 / render_fps
        listfile = os.path.join(RUN_DIR, "render-%s.txt" % tid)
        with open(listfile, "w") as f:
            for n in frames:
                p = os.path.join(fdir, n).replace("'", "'\\''")
                f.write("file '%s'\nduration %.6f\n" % (p, dur))
            # Osobliwość demuxera "concat" ffmpeg: duration ostatniego wpisu jest ignorowane,
            # więc ostatnia klatka w ogóle nie trafiłaby do wideo - trzeba ją wylistować
            # drugi raz, bez duration (standardowa, dokumentowana obejście ffmpeg).
            last = os.path.join(fdir, frames[-1]).replace("'", "'\\''")
            f.write("file '%s'\n" % last)

        out_name = "%s_%s.mp4" % (tid, time.strftime("%Y%m%d-%H%M%S"))
        out_path = os.path.join(vdir, out_name)
        tmp_path = out_path + ".tmp.mp4"
        cmd = _niced(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listfile,
                      "-vsync", "vfr", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast",
                      "-movflags", "+faststart", tmp_path])
        with RENDER_LOCK:
            try:
                p = subprocess.run(cmd, capture_output=True, timeout=max(120, len(frames) * 3))
                if p.returncode != 0 or not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
                    raise RuntimeError(_ffmpeg_err(p.stderr) or "ffmpeg nie utworzył pliku wyjściowego")
                os.replace(tmp_path, out_path)
            finally:
                for p2 in (listfile, tmp_path):
                    try:
                        os.remove(p2)
                    except OSError:
                        pass

        c2 = load()
        t2 = next((x for x in c2["timelapses"] if x["id"] == tid), None)
        if t2:
            t2["last_rendered_ts"] = now_ts
            save(c2)
        rt_log(tid, "renderowanie zakończone: %s (%d klatek @ %.1f kl./s)" % (out_name, len(frames), render_fps))

        # Kopia do /media (Media Browser HA) - wygodny, nieobowiązkowy bonus; brak zamapowanego
        # /media albo brak miejsca nie powinien psuć samego renderu, więc best-effort.
        try:
            mdir = os.path.join(MEDIA_DIR, tid)
            os.makedirs(mdir, exist_ok=True)
            shutil.copy2(out_path, os.path.join(mdir, out_name))
        except Exception:
            pass
    finally:
        rt_set(tid, rendering=False)


# ------------------------------------------------------------------- czyszczenie (retencja)

def _cleanup_frames(tid, days):
    d = os.path.join(FRAMES_DIR, tid)
    cutoff = time.time() - max(1, days) * 86400
    try:
        names = os.listdir(d)
    except OSError:
        return
    for n in names:
        if not n.endswith(".jpg"):
            continue
        try:
            ts = int(n[:-4])
        except ValueError:
            continue
        if ts < cutoff:
            try:
                os.remove(os.path.join(d, n))
            except OSError:
                pass


def _cleanup_videos(tid, days):
    if days <= 0:   # 0 = bez limitu
        return
    d = os.path.join(VIDEOS_DIR, tid)
    cutoff = time.time() - days * 86400
    try:
        names = os.listdir(d)
    except OSError:
        return
    for n in names:
        p = os.path.join(d, n)
        try:
            if os.path.getmtime(p) < cutoff:
                os.remove(p)
        except OSError:
            pass


def cleanup_loop():
    while True:
        try:
            for t in load()["timelapses"]:
                _cleanup_frames(t["id"], to_int(t.get("frame_days"), 1, 365, 3))
                _cleanup_videos(t["id"], to_int(t.get("video_days"), 0, 3650, 90))
        except Exception as e:
            log("czyszczenie: błąd %r" % e)
        time.sleep(600)


# ---------------------------------------------------------------- nadzór nad przechwytywaniem

WORKERS = {}
WORKERS_LOCK = threading.Lock()


class Worker:
    """Jeden timelapse = jeden wątek. Nawet gdy timelapse jest wstrzymany (enabled=false),
    wątek żyje dalej i tylko nic nie robi - prościej niż tworzenie/usuwanie wątków przy
    każdym kliknięciu pauzy/wznowienia."""

    def __init__(self, t):
        self.id = t["id"]
        self.stop_flag = threading.Event()
        self.pending = None
        self.next_capture = 0
        self.last_render_date = ""
        rt_set(self.id, status="start…")
        self.thread = threading.Thread(target=self._run, args=(dict(t),), daemon=True)
        self.thread.start()

    def update(self, t):
        self.pending = dict(t)
        self.next_capture = 0   # nowe parametry (np. inny adres/interwał) - sprawdź od razu

    def stop(self):
        self.stop_flag.set()

    def _run(self, t):
        cur = t
        while not self.stop_flag.is_set():
            if self.pending is not None:
                cur = self.pending
                self.pending = None
            if cur.get("enabled", True):
                if time.time() >= self.next_capture:
                    capture_once(self.id, cur)
                    self.next_capture = time.time() + to_int(cur.get("interval_sec"), 5, 86400, 300)
                self._maybe_render(cur)
            else:
                rt_set(self.id, status="wstrzymany")
            time.sleep(1)
        rt_set(self.id, status="zatrzymany")

    def _maybe_render(self, cur):
        rtm = cur.get("render_time") or "00:05"
        today = time.strftime("%Y-%m-%d")
        if today != self.last_render_date and time.strftime("%H:%M") >= rtm:
            self.last_render_date = today
            enqueue_render(self.id, "harmonogram %s" % rtm)


def reconcile():
    c = load()
    with WORKERS_LOCK:
        wanted = {t["id"]: dict(t) for t in c["timelapses"]}
        for tid in list(WORKERS):
            if tid not in wanted:
                WORKERS.pop(tid).stop()
        for tid, t in wanted.items():
            if tid in WORKERS:
                WORKERS[tid].update(t)
            else:
                WORKERS[tid] = Worker(t)


# ---------------------------------------------------------------------------- panel (Ingress)

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "timelapse-rtsp"

    def log_message(self, fmt, *args):
        if os.environ.get("TL_DEBUG"):
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
        # Proxy Ingress HA (z ingress_stream: true) czasem przekazuje POST/PUT bez nagłówka
        # Content-Length, tylko z Transfer-Encoding: chunked (sprawdzone i naprawione już w
        # dodatku Dashboard RTSP) - trzeba samemu zdekodować chunked, inaczej body wychodzi
        # puste mimo że klient faktycznie coś wysłał.
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
                self.rfile.read(2)
            return b"".join(chunks)
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def body_json(self):
        raw = self._read_body()
        try:
            return json.loads(raw or b"{}")
        except ValueError:
            raise ValueError("błędny JSON")

    def _serve_video(self, path_on_disk):
        try:
            size = os.path.getsize(path_on_disk)
        except OSError:
            raise KeyError(path_on_disk)
        start, end, status = 0, size - 1, 200
        rng = self.headers.get("Range")
        if rng and rng.startswith("bytes="):
            try:
                a, _, b = rng[6:].partition("-")
                if a:
                    start = int(a)
                if b:
                    end = int(b)
                status = 206
            except ValueError:
                pass
        end = min(end, size - 1)
        length = max(0, end - start + 1)
        self.send_response(status)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command == "HEAD" or length == 0:
            return
        with open(path_on_disk, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                remaining -= len(chunk)

    def route(self):
        try:
            self._route()
        except KeyError:
            self.send(404, {"error": "nie znaleziono"})
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
            return self.send(200, {"timelapses": load()["timelapses"], "version": ADDON_VERSION})

        if self.command == "GET" and path == "/api/status":
            c = load()
            out = {}
            for t in c["timelapses"]:
                tid = t["id"]
                r = rt_get(tid)
                try:
                    fc = len([n for n in os.listdir(os.path.join(FRAMES_DIR, tid)) if n.endswith(".jpg")])
                except OSError:
                    fc = 0
                out[tid] = {"status": r["status"], "last_capture_ts": r["last_capture_ts"],
                            "frame_count": fc, "rendering": r["rendering"]}
            return self.send(200, out)

        if self.command == "POST" and path == "/api/timelapses":
            b = self.body_json()
            name = str(b.get("name", "")).strip()[:60] or "Timelapse"
            url = str(b.get("rtsp_url", "")).strip()
            if not url.lower().startswith("rtsp://"):
                raise ValueError("adres musi zaczynać się od rtsp://")
            c = load()
            tid = secrets.token_hex(4)
            c["timelapses"].append({
                "id": tid, "name": name, "rtsp_url": url,
                "transport": "udp" if str(b.get("transport")) == "udp" else "tcp",
                "interval_sec": to_int(b.get("interval_sec"), 5, 86400, 300),
                "render_time": to_time(b.get("render_time"), "00:05"),
                "render_fps": to_fps(b.get("render_fps"), 24),
                "frame_days": to_int(b.get("frame_days"), 1, 365, 3),
                "video_days": to_int(b.get("video_days"), 0, 3650, 90),
                "enabled": True,
                "last_rendered_ts": 0,
            })
            save(c)
            reconcile()
            return self.send(200, {"ok": True, "id": tid})

        ms = re.match(r"^/api/snapshot/([a-z0-9]{1,20})$", path)
        if self.command == "GET" and ms:
            fdir = os.path.join(FRAMES_DIR, ms.group(1))
            try:
                names = sorted(n for n in os.listdir(fdir) if n.endswith(".jpg"))
            except OSError:
                names = []
            if not names:
                raise KeyError(ms.group(1))
            with open(os.path.join(fdir, names[-1]), "rb") as f:
                return self.send(200, f.read(), "image/jpeg")

        if self.command == "GET" and path.startswith("/api/log/"):
            tid = path[len("/api/log/"):]
            if not ID_RE.match(tid):
                raise KeyError(tid)
            r = rt_get(tid)
            return self.send(200, "\n".join(r["log"][-200:]), "text/plain; charset=utf-8")

        mv = re.match(r"^/api/timelapses/([a-z0-9]{1,20})/videos$", path)
        if self.command == "GET" and mv:
            vdir = os.path.join(VIDEOS_DIR, mv.group(1))
            out = []
            try:
                for n in sorted(os.listdir(vdir), reverse=True):
                    if not n.endswith(".mp4"):
                        continue
                    p = os.path.join(vdir, n)
                    out.append({"name": n, "size": os.path.getsize(p), "mtime": int(os.path.getmtime(p))})
            except OSError:
                pass
            return self.send(200, out)

        mr = re.match(r"^/api/timelapses/([a-z0-9]{1,20})/render$", path)
        if self.command == "POST" and mr:
            if not any(x["id"] == mr.group(1) for x in load()["timelapses"]):
                raise KeyError(mr.group(1))
            enqueue_render(mr.group(1), "ręcznie")
            return self.send(200, {"ok": True})

        mc = re.match(r"^/api/timelapses/([a-z0-9]{1,20})/capture-now$", path)
        if self.command == "POST" and mc:
            tid = mc.group(1)
            t = next((x for x in load()["timelapses"] if x["id"] == tid), None)
            if not t:
                raise KeyError(tid)
            # Zawsze łapie klatkę w osobnym wątku, niezależnie od tego, czy timelapse jest
            # aktualnie wstrzymany (enabled=false) - zwykły wątek Workera w ogóle nie
            # przechwytuje klatek, gdy enabled=false (patrz Worker._run), więc samo tylko
            # "sztuknięcie" next_capture=0 nic by tu nie dało (a w ogóle zależałoby od
            # wyścigu: czy wątek już zdążył odczytać swój nowy stan `enabled`, czy jeszcze nie).
            threading.Thread(target=capture_once, args=(tid, t), daemon=True).start()
            return self.send(200, {"ok": True})

        m = re.match(r"^/api/timelapses/([a-z0-9]{1,20})$", path)
        if self.command == "PUT" and m:
            b = self.body_json()
            c = load()
            t = next((x for x in c["timelapses"] if x["id"] == m.group(1)), None)
            if not t:
                raise KeyError(m.group(1))
            if "name" in b:
                t["name"] = str(b["name"]).strip()[:60] or t["name"]
            if "rtsp_url" in b and str(b["rtsp_url"]).strip():
                url = str(b["rtsp_url"]).strip()
                if not url.lower().startswith("rtsp://"):
                    raise ValueError("adres musi zaczynać się od rtsp://")
                t["rtsp_url"] = url
            if "transport" in b:
                t["transport"] = "udp" if str(b["transport"]) == "udp" else "tcp"
            if "interval_sec" in b:
                t["interval_sec"] = to_int(b.get("interval_sec"), 5, 86400, t["interval_sec"])
            if "render_time" in b:
                t["render_time"] = to_time(b.get("render_time"), t["render_time"])
            if "render_fps" in b:
                t["render_fps"] = to_fps(b.get("render_fps"), t["render_fps"])
            if "frame_days" in b:
                t["frame_days"] = to_int(b.get("frame_days"), 1, 365, t["frame_days"])
            if "video_days" in b:
                t["video_days"] = to_int(b.get("video_days"), 0, 3650, t["video_days"])
            if "enabled" in b:
                t["enabled"] = bool(b["enabled"])
            save(c)
            reconcile()
            return self.send(200, {"ok": True})

        if self.command == "DELETE" and m:
            c = load()
            before = len(c["timelapses"])
            c["timelapses"] = [x for x in c["timelapses"] if x["id"] != m.group(1)]
            if len(c["timelapses"]) == before:
                raise KeyError(m.group(1))
            save(c)
            reconcile()
            for base in (FRAMES_DIR, VIDEOS_DIR):
                shutil.rmtree(os.path.join(base, m.group(1)), ignore_errors=True)
            shutil.rmtree(os.path.join(MEDIA_DIR, m.group(1)), ignore_errors=True)
            with RUNTIME_LOCK:
                RUNTIME.pop(m.group(1), None)
            return self.send(200, {"ok": True})

        mf = re.match(r"^/api/videos/([a-z0-9]{1,20})/([^/]+)$", path)
        if self.command in ("GET", "HEAD") and mf and FILE_RE.match(mf.group(2)):
            p = os.path.join(VIDEOS_DIR, mf.group(1), mf.group(2))
            if not os.path.isfile(p):
                raise KeyError(mf.group(2))
            return self._serve_video(p)

        if self.command == "DELETE" and mf and FILE_RE.match(mf.group(2)):
            p = os.path.join(VIDEOS_DIR, mf.group(1), mf.group(2))
            if not os.path.isfile(p):
                raise KeyError(mf.group(2))
            os.remove(p)
            try:
                os.remove(os.path.join(MEDIA_DIR, mf.group(1), mf.group(2)))
            except OSError:
                pass
            return self.send(200, {"ok": True})

        return self.send(404, {"error": "nie znaleziono"})

    do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = route


def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(FRAMES_DIR, exist_ok=True)
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    os.makedirs(RUN_DIR, exist_ok=True)
    reconcile()
    threading.Thread(target=render_worker_loop, daemon=True).start()
    threading.Thread(target=cleanup_loop, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    log("Timelapse RTSP: panel na porcie %d, timelapse'y: %d" % (PORT, len(load()["timelapses"])))
    srv.serve_forever()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *a: os._exit(0))
    main()
