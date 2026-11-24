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
import base64
import json
import os
import queue
import re
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("TL_PORT", "18097"))   # = ingress_port w config.yaml
# DATA to WŁASNY, zawsze dostępny katalog dodatku (Supervisor gwarantuje go bez żadnego
# `map:` w config.yaml) - tu zawsze mieszka config.json, niezależnie od tego, gdzie
# użytkownik skonfiguruje przechowywanie klatek/wideo (storage_dir, patrz niżej). Inaczej
# zmiana storage_dir na niedostępną ścieżkę zablokowałaby odczyt samej konfiguracji.
DATA = os.environ.get("TL_DATA", "/data")
CONF = os.path.join(DATA, "config.json")
MEDIA_DIR = "/media/timelapse_rtsp"   # kopia gotowych filmów, jeśli /media jest zamapowane (wygodny podgląd w HA)
DISK_WARN_PERCENT = 5.0
RUN_DIR = "/tmp/timelapse-rtsp"
APP_DIR = os.path.dirname(os.path.abspath(__file__))
INGRESS_ONLY = os.environ.get("TL_ANY_CLIENT") != "1"
INGRESS_GW = "172.30.32.2"
ID_RE = re.compile(r"^[a-z0-9]{1,20}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
FILE_RE = re.compile(r"^[A-Za-z0-9_.-]{1,120}$")
CAPTURE_WINDOWS = ("always", "time_range", "night", "day")
ADDON_VERSION = "1.2.7"          # = version w config.yaml

NICE_BIN = shutil.which("nice")
SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN") or os.environ.get("HASSIO_TOKEN")


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)


# Chroni config.json przed ściganiem się wątków: każde żądanie HTTP (dodanie/edycja/usunięcie/
# ustawienia) obsługiwane jest przez ThreadingHTTPServer na osobnym wątku, a do tego dochodzi
# wątek renderowania (do_render), który też dopisuje last_rendered_ts. Bez tej blokady dwa
# zapisy w tym samym momencie potrafiły się nawzajem nadpisać w trakcie pisania do wspólnego
# pliku tymczasowego (ten sam "CONF + '.tmp'" dla każdego wątku) - co czasem kończyło się
# uszkodzonym/obciętym JSON-em w config.json. load() wtedy łapał wyjątek przy parsowaniu i po
# cichu wracał do pustej konfiguracji ({"timelapses": []}) - w panelu wyglądało to tak, jakby
# wszystkie timelapse'y nagle zniknęły (aż do kolejnego poprawnego zapisu, który je przywracał).
CONF_LOCK = threading.Lock()


CONF_BACKUP = "/share/timelapse_rtsp/config_backup.json"


def load():
    try:
        c = json.load(open(CONF))
    except Exception:
        c = {}
    if not c.get("timelapses"):
        # /data jest prywatnym folderem TEGO dodatku - przy odinstalowaniu (nie tylko
        # aktualizacji/restarcie) Supervisor go kasuje razem z dodatkiem. /share jest
        # współdzielone między wszystkimi dodatkami i samym HA, więc przeżywa
        # odinstalowanie/reinstalację - stąd trzymana tam kopia zapasowa (patrz save()).
        # Jeśli /data wygląda na puste (świeża instalacja po reinstalacji), a kopia w
        # /share istnieje, przywróć z niej automatycznie - bez tego trzeba by ręcznie
        # wpisywać wszystkie timelapse'y od nowa po każdym odinstalowaniu dodatku.
        try:
            backup = json.load(open(CONF_BACKUP))
            if backup.get("timelapses"):
                c = backup
                log("przywrócono config.json z kopii zapasowej w /share (prawdopodobnie "
                    "świeży /data po odinstalowaniu/reinstalacji dodatku) - %d timelapse'ów" %
                    len(backup["timelapses"]))
                save(c)
        except Exception:
            pass
    c.setdefault("timelapses", [])
    c.setdefault("storage_dir", DATA)
    # Globalne ustawienia DOODS (jeden współdzielony serwer wykrywania dla wszystkich
    # timelapse'ów - samo DOODS nie jest częścią tego dodatku, użytkownik uruchamia je osobno).
    c.setdefault("doods_url", "")
    c.setdefault("doods_detector", "default")
    c.setdefault("doods_auth_key", "")
    c.setdefault("doods_confidence", 50)
    return c


def save(c):
    os.makedirs(DATA, exist_ok=True)
    # Osobny plik tymczasowy na wątek (nie tylko blokada) - dodatkowe zabezpieczenie na
    # wypadek, gdyby kiedyś jakiś zapis odbył się poza CONF_LOCK.
    tmp = CONF + (".tmp.%d" % threading.get_ident())
    with open(tmp, "w") as f:
        json.dump(c, f, ensure_ascii=False, indent=1)
    os.replace(tmp, CONF)
    # Kopia zapasowa w /share (patrz CONF_BACKUP) - best-effort, nigdy nie blokuje
    # normalnego zapisu. Jeśli /share z jakiegoś powodu nie jest dostępne, po prostu nie
    # będzie backupu - nie przerywamy przez to zwykłego działania dodatku.
    try:
        os.makedirs(os.path.dirname(CONF_BACKUP), exist_ok=True)
        tmp_b = CONF_BACKUP + (".tmp.%d" % threading.get_ident())
        with open(tmp_b, "w") as f:
            json.dump(c, f, ensure_ascii=False, indent=1)
        os.replace(tmp_b, CONF_BACKUP)
    except Exception:
        pass


def storage_dir():
    """Skonfigurowalne miejsce na klatki/wideo - domyślnie to samo co DATA, ale użytkownik
    może je zmienić w Ustawieniach (np. na /media/... albo /share/..., jeśli dysk dodatku
    jest mały). config.json zawsze zostaje w DATA (patrz komentarz przy stałej DATA)."""
    return load().get("storage_dir") or DATA


# --------------------------------------------------------- kamery z Home Assistanta (config:ro)

CONFIG_DIR = "/config"   # wymaga `config:ro` w map: (config.yaml) - tylko odczyt

_CAM_PLATFORM_RE = re.compile(r"^(\s*)-\s*platform:\s*(generic|ffmpeg)\s*$")
_CAM_FIELD_RE = re.compile(r"^(\s*)(name|stream_source|input):\s*(.+?)\s*$")


def _scan_yaml_file_for_cameras(path, out):
    """Bardzo proste, LINIOWE skanowanie bloków `- platform: generic/ffmpeg` w pliku YAML
    Home Assistanta - celowo NIE pełny parser YAML (HA używa własnych tagów !include/
    !secret/!include_dir_merge_named itp., których zwykły `yaml.safe_load` by nie obsłużył
    bez dodatkowej pracy, a ten dodatek nie ma nawet biblioteki PyYAML w obrazie). Wystarcza
    to do rozpoznania typowych wpisów kamer - coś bardziej nietypowego po prostu nie trafi
    na listę (trzeba wtedy wpisać ręcznie, jak dotąd)."""
    with open(path, "r", errors="ignore") as f:
        lines = f.readlines()
    i, n = 0, len(lines)
    while i < n:
        m = _CAM_PLATFORM_RE.match(lines[i])
        if not m:
            i += 1
            continue
        base_indent = len(m.group(1))
        entry = {}
        j = i + 1
        while j < n:
            line = lines[j]
            if not line.strip():
                j += 1
                continue
            indent = len(line) - len(line.lstrip(" "))
            if indent <= base_indent:
                break
            fm = _CAM_FIELD_RE.match(line)
            if fm:
                entry[fm.group(2)] = fm.group(3).strip().strip("\"'")
            j += 1
        name = entry.get("name") or ("kamera z %s" % os.path.basename(path))
        url = entry.get("stream_source") or entry.get("input")
        if url and url.startswith("!secret"):
            # Nigdy nie czytamy secrets.yaml - taka kamera trafia na listę BEZ adresu,
            # do ręcznego uzupełnienia, zamiast cichego podstawiania czegokolwiek.
            url = None
        if name not in out or (url and not out[name].get("rtsp_url")):
            out[name] = {"name": name, "rtsp_url": url, "source": "yaml"}
        i = j


def discover_ha_cameras():
    """Best-effort lista kamer z configu Home Assistanta (nazwa + adres RTSP, jeśli jawny),
    do wyboru przy dodawaniu timelapse'u zamiast ręcznego wpisywania wszystkiego. Dwa
    źródła, oba tylko do odczytu:
      1. /config/.storage/core.config_entries (JSON) - kamery dodane przez UI, integracja
         "generic"/"ffmpeg" trzyma tam stream_source jawnym tekstem.
      2. Zwykłe pliki *.yaml pod /config - kamery skonfigurowane ręcznie w YAML (patrz
         _scan_yaml_file_for_cameras - celowo uproszczone skanowanie, nie pełny parser).
    Nigdy nie otwiera secrets.yaml. Jeśli /config nie jest zamapowane (starsza wersja
    dodatku przed dodaniem config:ro) albo coś pójdzie nie tak - po prostu pusta lista,
    bez przerywania działania reszty panelu."""
    out = {}
    try:
        entries = json.load(open(os.path.join(CONFIG_DIR, ".storage", "core.config_entries")))
        for e in entries.get("data", {}).get("entries", []):
            if e.get("domain") not in ("generic", "ffmpeg"):
                continue
            opts = e.get("options") or e.get("data") or {}
            url = opts.get("stream_source") or opts.get("input")
            name = e.get("title") or "Kamera"
            if url:
                out[name] = {"name": name, "rtsp_url": url, "source": "ui"}
    except Exception:
        pass
    try:
        for root, _dirs, files in os.walk(CONFIG_DIR):
            if os.sep + ".storage" in root + os.sep:
                continue
            for fn in files:
                if fn == "secrets.yaml" or not fn.endswith((".yaml", ".yml")):
                    continue
                try:
                    _scan_yaml_file_for_cameras(os.path.join(root, fn), out)
                except Exception:
                    pass
    except Exception:
        pass
    return sorted(out.values(), key=lambda x: x["name"].lower())


def frames_root():
    return os.path.join(storage_dir(), "frames")


def videos_root():
    return os.path.join(storage_dir(), "videos")


def validate_storage_dir(path):
    path = str(path or "").strip()
    if not path.startswith("/"):
        raise ValueError("ścieżka musi być absolutna (zaczynać się od /)")
    path = path.rstrip("/") or "/"
    try:
        os.makedirs(path, exist_ok=True)
        probe = os.path.join(path, ".tl_write_test")
        with open(probe, "w") as f:
            f.write("ok")
        os.remove(probe)
    except OSError as e:
        raise ValueError("nie można zapisywać w %s: %s" % (path, e))
    return path


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


def to_window(v, default):
    v = str(v or "")
    return v if v in CAPTURE_WINDOWS else default


# ------------------------------------------------------------------- stan słońca (wschód/zachód)

# "night"/"day" jako okno przechwytywania potrzebuje wiedzieć, czy słońce jest aktualnie nad
# czy pod horyzontem. Zamiast liczyć to samemu (potrzebna byłaby szerokość/długość
# geograficzna od użytkownika, plus kod astronomiczny do utrzymania), odpytujemy encję
# `sun.sun`, którą Home Assistant i tak zawsze ma (liczoną z lokalizacji ustawionej w
# Ustawieniach HA) - przez proxy Supervisora, autoryzowane tokenem SUPERVISOR_TOKEN, który
# Supervisor sam wstrzykuje do kontenera dodatku, gdy w config.yaml jest `homeassistant_api:
# true` (bez potrzeby żadnego tokenu wklejanego przez użytkownika, w odróżnieniu od dodatku
# Dashboard RTSP, który loguje się do samego frontendu, nie tylko odpytuje stan).
SUN = {"above_horizon": None, "updated": 0, "error": None}
SUN_LOCK = threading.Lock()


def sun_above_horizon():
    with SUN_LOCK:
        return SUN["above_horizon"]


def sun_status():
    """Diagnostyka dla panelu — żeby okno 'dzień'/'noc' nigdy nie zawodziło *po cichu*.
    Bez tego, przy np. braku SUPERVISOR_TOKEN po aktualizacji bez restartu dodatku, timelapse
    po prostu łapał klatki całą dobę (fallback „nie blokuj przechwytywania” w
    in_capture_window), a jedyny trop był w logu dodatku, którego nikt nie czyta rutynowo —
    więc wyglądało to jak zwykły bug ('wybrałem dzień, a łapie też w nocy'), nie jak
    utrata łączności z API HA."""
    if not SUPERVISOR_TOKEN:
        return {"ok": False, "above_horizon": None,
                "error": "Brak dostępu do API Home Assistant (SUPERVISOR_TOKEN) — dodatek "
                         "prawdopodobnie zaktualizowany bez restartu. Zrestartuj dodatek w "
                         "Ustawienia → Dodatki → Timelapse RTSP."}
    with SUN_LOCK:
        above, updated, error = SUN["above_horizon"], SUN["updated"], SUN["error"]
    if error and (above is None or time.time() - updated > 300):
        return {"ok": False, "above_horizon": above, "error": error}
    return {"ok": above is not None, "above_horizon": above, "error": None}


def sun_loop():
    if not SUPERVISOR_TOKEN:
        log("brak SUPERVISOR_TOKEN - okna przechwytywania 'noc'/'dzień' będą niedostępne "
            "(traktowane jak 'zawsze'), dopóki dodatek nie zostanie zrestartowany z dostępem do API HA")
        return
    import urllib.request
    url = "http://supervisor/core/api/states/sun.sun"
    headers = {"Authorization": "Bearer " + SUPERVISOR_TOKEN}
    while True:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read())
            with SUN_LOCK:
                SUN["above_horizon"] = (data.get("state") == "above_horizon")
                SUN["updated"] = time.time()
                SUN["error"] = None
        except Exception as e:
            with SUN_LOCK:
                SUN["error"] = "nie udało się odczytać stanu słońca (sun.sun) z Home Assistant: %r" % e
            log("nie udało się odczytać stanu słońca (sun.sun) z Home Assistant: %r" % e)
        time.sleep(120)   # stan słońca zmienia się rzadko - co 2 minuty w zupełności wystarczy


def in_capture_window(cur):
    mode = to_window(cur.get("capture_window"), "always")
    if mode == "always":
        return True
    if mode == "time_range":
        start = to_time(cur.get("window_start"), "20:00")
        end = to_time(cur.get("window_end"), "06:00")
        now_hm = time.strftime("%H:%M")
        if start <= end:
            return start <= now_hm <= end
        return now_hm >= start or now_hm <= end   # zakres przechodzący przez północ, np. 20:00–06:00
    # "night"/"day": brak jeszcze odczytu z HA (np. tuż po starcie dodatku, albo brak
    # SUPERVISOR_TOKEN) - nie blokuj przechwytywania, lepiej złapać klatkę "na wszelki
    # wypadek" niż przegapić całe okno przez chwilową niedostępność stanu słońca.
    above = sun_above_horizon()
    if above is None:
        return True
    return above if mode == "day" else (not above)


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
            # "-f mjpeg" wymusza format wyjścia wprost - bez tego ffmpeg zgaduje go z
            # rozszerzenia pliku, a plik tymczasowy kończy się na ".tmp" (nie ".jpg"), co
            # ffmpeg nie rozpoznaje jako żaden znany format i wywala się "Error initializing
            # the muxer... Invalid argument" (widoczne tylko wtedy, gdy ffmpeg w ogóle
            # zdołał się połączyć ze strumieniem - inaczej ten błąd był zasłonięty przez
            # wcześniejszy błąd połączenia).
            ["ffmpeg", "-y", "-rtsp_transport", transport, "-i", rtsp_url,
             "-frames:v", "1", "-q:v", "3", "-f", "mjpeg", tmp],
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


def _free_frame_path(fdir, ts):
    """Zwraca ścieżkę "%010d.jpg" dla danego ts, a jeśli jest już zajęta (dodatkowe
    przechwycenie po wykryciu osoby trafiło w tę samą sekundę co zwykłe), przesuwa się o
    kolejne sekundy, żeby nie nadpisać istniejącej klatki."""
    while True:
        path = os.path.join(fdir, "%010d.jpg" % ts)
        if not os.path.exists(path):
            return path, ts
        ts += 1


# ------------------------------------------------------------------ wykrywanie osób (DOODS)
# Integracja z DOODS (Dedicated Open Object Detection Service, github.com/snowzach/doods) -
# osobnym, już działającym u użytkownika serwerem wykrywania obiektów. Ten dodatek go nie
# uruchamia ani nie konfiguruje - tylko wysyła do niego już złapaną klatkę i pyta, czy jest
# na niej osoba. Brak skonfigurowanego adresu albo jakikolwiek błąd połączenia z DOODS nigdy
# nie przerywa zwykłego przechwytywania klatek - wykrywanie osób to czysty dodatek, nie
# zależność.
DOODS_COOLDOWN_SEC = 20   # nie częściej niż raz na tyle sekund na timelapse - inaczej osoba
                          # stojąca dłużej w kadrze zasypałaby klatki niemal tym samym ujęciem
_last_person_capture = {}
_last_person_capture_lock = threading.Lock()


def detect_person(cfg, jpeg_path):
    """Wysyła klatkę JPEG do DOODS (POST /detect, patrz github.com/snowzach/doods) i zwraca
    True, jeśli DOODS zwrócił wykrycie etykiety "person" (próg pewności ustawiony w samym
    zapytaniu, w polu "detect")."""
    url = (cfg.get("doods_url") or "").rstrip("/")
    if not url:
        return False
    import urllib.request
    try:
        with open(jpeg_path, "rb") as f:
            data = base64.b64encode(f.read()).decode("ascii")
        conf = to_int(cfg.get("doods_confidence"), 1, 99, 50)
        body = {
            "detector_name": cfg.get("doods_detector") or "default",
            "data": data,
            "detect": {"person": conf},
        }
        if cfg.get("doods_auth_key"):
            body["auth_key"] = cfg["doods_auth_key"]
        req = urllib.request.Request(
            url + "/detect", data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=15) as r:
            res = json.loads(r.read())
        return any(d.get("label") == "person" for d in res.get("detections", []))
    except Exception as e:
        log("DOODS: zapytanie o wykrywanie osób nie powiodło się: %r" % e)
        return False


def capture_once(tid, t):
    fdir = os.path.join(frames_root(), tid)
    os.makedirs(fdir, exist_ok=True)
    ts = int(time.time())
    path = os.path.join(fdir, "%010d.jpg" % ts)
    try:
        capture_frame(t["rtsp_url"], path, transport=t.get("transport", "tcp"))
        rt_set(tid, status="działa", last_capture_ts=ts)
    except Exception as e:
        rt_set(tid, status="błąd przechwytywania")
        rt_log(tid, "przechwytywanie klatki nie powiodło się: %s" % scrub_creds(str(e), t.get("rtsp_url", "")))
        return

    if not t.get("person_detect"):
        return
    cfg = load()
    if not cfg.get("doods_url"):
        return
    with _last_person_capture_lock:
        last = _last_person_capture.get(tid, 0)
        if time.time() - last < DOODS_COOLDOWN_SEC:
            return
    if detect_person(cfg, path):
        with _last_person_capture_lock:
            _last_person_capture[tid] = time.time()
        rt_log(tid, "wykryto osobę (DOODS) — dodatkowe przechwycenie klatki")
        extra_ts = int(time.time())
        extra_path, extra_ts = _free_frame_path(fdir, extra_ts)
        try:
            capture_frame(t["rtsp_url"], extra_path, transport=t.get("transport", "tcp"))
            rt_set(tid, status="działa", last_capture_ts=extra_ts)
        except Exception as e:
            rt_log(tid, "dodatkowe przechwycenie po wykryciu osoby nie powiodło się: %s" %
                   scrub_creds(str(e), t.get("rtsp_url", "")))


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
    fdir = os.path.join(frames_root(), tid)
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
        vdir = os.path.join(videos_root(), tid)
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

        with CONF_LOCK:
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


# ------------------------------------------------------------ scalanie wszystkich filmów

def merge_all_videos(tid):
    """Łączy wszystkie gotowe pliki mp4 danego timelapse'u w jeden, w kolejności nagrania
    (nazwy plików zaczynają się od znacznika czasu renderu, więc zwykłe sortowanie
    alfabetyczne = chronologiczne). Dzieli ten sam `RENDER_LOCK`/`nice` co zwykłe
    renderowanie (patrz do_render) - to też ciężka operacja ffmpeg, więc nie powinna
    odpalać się równolegle z renderem ani zabierać CPU innym procesom."""
    c = load()
    t = next((x for x in c["timelapses"] if x["id"] == tid), None)
    if not t:
        return
    vdir = os.path.join(videos_root(), tid)
    try:
        names = sorted(n for n in os.listdir(vdir)
                        if n.endswith(".mp4") and ".tmp" not in n)
    except OSError:
        names = []
    if len(names) < 2:
        rt_log(tid, "scalanie: za mało gotowych filmów do scalenia (potrzeba co najmniej 2)")
        return

    rt_set(tid, rendering=True)
    rt_log(tid, "scalanie %d plików wideo w jeden…" % len(names))
    listfile = os.path.join(RUN_DIR, "merge-%s.txt" % tid)
    out_name = "%s_scalone_%s.mp4" % (tid, time.strftime("%Y%m%d-%H%M%S"))
    out_path = os.path.join(vdir, out_name)
    tmp_path = out_path + ".tmp.mp4"
    try:
        with open(listfile, "w") as f:
            for n in names:
                p = os.path.join(vdir, n).replace("'", "'\\''")
                f.write("file '%s'\n" % p)

        def run_concat(extra_args):
            cmd = _niced(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listfile] +
                         extra_args + ["-movflags", "+faststart", tmp_path])
            with RENDER_LOCK:
                return subprocess.run(cmd, capture_output=True,
                                       timeout=max(120, len(names) * 30))

        # Najpierw szybkie, bezstratne scalenie ("stream copy" - bez ponownego kodowania) -
        # działa, bo wszystkie pliki pochodzą z tego samego timelapse'u i normalnie mają ten
        # sam kodek/parametry (ffmpeg zawsze koduje je tak samo, patrz do_render). Jeśli się
        # nie uda (np. pliki nagrane różnymi wersjami dodatku z inną konfiguracją kodeka),
        # spróbuj ponownie z pełnym przekodowaniem - wolniejsze, ale odporne na drobne
        # różnice między plikami.
        p = run_concat(["-c", "copy"])
        if p.returncode != 0 or not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
            rt_log(tid, "scalanie: szybkie łączenie się nie powiodło (%s) — próbuję z "
                        "ponownym kodowaniem (wolniej)" % (_ffmpeg_err(p.stderr) or "?"))
            p = run_concat(["-vsync", "vfr", "-pix_fmt", "yuv420p",
                            "-c:v", "libx264", "-preset", "veryfast"])
            if p.returncode != 0 or not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
                raise RuntimeError(_ffmpeg_err(p.stderr) or "ffmpeg nie utworzył pliku wyjściowego")
        os.replace(tmp_path, out_path)
        rt_log(tid, "scalanie zakończone: %s (%d plików)" % (out_name, len(names)))

        try:
            mdir = os.path.join(MEDIA_DIR, tid)
            os.makedirs(mdir, exist_ok=True)
            shutil.copy2(out_path, os.path.join(mdir, out_name))
        except Exception:
            pass
    except Exception as e:
        rt_log(tid, "scalanie nie powiodło się: %r" % e)
    finally:
        for p2 in (listfile, tmp_path):
            try:
                os.remove(p2)
            except OSError:
                pass
        rt_set(tid, rendering=False)


# ------------------------------------------------------------------- czyszczenie (retencja)

def _cleanup_frames(tid, days):
    d = os.path.join(frames_root(), tid)
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
    d = os.path.join(videos_root(), tid)
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


# ------------------------------------------------------------------- miejsce na dysku

DISK = {"path": DATA, "percent_free": 100.0, "total": 0, "free": 0, "low": False}
DISK_LOCK = threading.Lock()
LOW_DISK_NOTIF_ID = "timelapse_rtsp_low_disk"


def _ha_notify_call(service, payload):
    """Prawdziwe powiadomienie Home Assistant (persistent_notification), nie tylko baner w
    panelu - widoczne nawet, gdy nikt akurat nie ma otwartego panelu dodatku. Przez to samo
    proxy Supervisora co stan słońca (SUPERVISOR_TOKEN, wymaga homeassistant_api: true)."""
    if not SUPERVISOR_TOKEN:
        return
    import urllib.request
    try:
        req = urllib.request.Request(
            "http://supervisor/core/api/services/persistent_notification/%s" % service,
            data=json.dumps(payload).encode(),
            headers={"Authorization": "Bearer " + SUPERVISOR_TOKEN, "Content-Type": "application/json"},
            method="POST")
        urllib.request.urlopen(req, timeout=10).read()
    except Exception as e:
        log("nie udało się wysłać powiadomienia do Home Assistant: %r" % e)


def diskspace_loop():
    while True:
        try:
            d = storage_dir()
            st = os.statvfs(d)
            total = st.f_blocks * st.f_frsize
            free = st.f_bavail * st.f_frsize
            pct = (free / total * 100.0) if total else 100.0
            with DISK_LOCK:
                was_low = DISK["low"]
                low = pct < DISK_WARN_PERCENT
                DISK.update(path=d, percent_free=pct, total=total, free=free, low=low)
            if low and not was_low:
                log("UWAGA: mało miejsca na dysku w %s - %.1f%% wolnego" % (d, pct))
                _ha_notify_call("create", {
                    "notification_id": LOW_DISK_NOTIF_ID,
                    "title": "Timelapse RTSP — mało miejsca na dysku",
                    "message": ("Wolne miejsce w `%s` spadło do %.1f%% (próg: %.0f%%). Usuń stare "
                                 "pliki, zmniejsz retencję klatek/wideo albo zmień miejsce "
                                 "składowania w panelu dodatku (Ustawienia)." % (d, pct, DISK_WARN_PERCENT))})
            elif not low and was_low:
                _ha_notify_call("dismiss", {"notification_id": LOW_DISK_NOTIF_ID})
        except Exception as e:
            log("sprawdzanie miejsca na dysku: błąd %r" % e)
        time.sleep(300)


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
                    if in_capture_window(cur):
                        capture_once(self.id, cur)
                        self.next_capture = time.time() + to_int(cur.get("interval_sec"), 5, 86400, 300)
                    else:
                        # Poza oknem przechwytywania - nie łap klatki i nie przesuwaj
                        # next_capture, żeby złapać od razu w momencie otwarcia okna
                        # (sprawdzenie samego okna jest tanie, więc sprawdzanie go co 1 s,
                        # zamiast dopiero po `interval_sec`, nie ma znaczenia dla obciążenia).
                        rt_set(self.id, status="poza oknem przechwytywania")
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

        if self.command == "GET" and path == "/api/ha-cameras":
            return self.send(200, {"cameras": discover_ha_cameras()})

        if self.command == "GET" and path == "/api/settings":
            c = load()
            return self.send(200, {
                "storage_dir": storage_dir(),
                "doods_url": c.get("doods_url", ""),
                "doods_detector": c.get("doods_detector", "default"),
                "doods_auth_key_set": bool(c.get("doods_auth_key")),
                "doods_confidence": c.get("doods_confidence", 50),
            })

        if self.command == "POST" and path == "/api/settings":
            b = self.body_json()
            with CONF_LOCK:
                c = load()
                if "storage_dir" in b:
                    newdir = validate_storage_dir(b.get("storage_dir"))
                    c["storage_dir"] = newdir
                    log("miejsce składowania zmienione na: %s (dotyczy nowych klatek/renderów - "
                        "istniejące pliki zostają w starej lokalizacji)" % newdir)
                if "doods_url" in b:
                    c["doods_url"] = str(b["doods_url"]).strip().rstrip("/")
                if "doods_detector" in b:
                    c["doods_detector"] = str(b["doods_detector"]).strip() or "default"
                if "doods_auth_key" in b and b["doods_auth_key"]:
                    c["doods_auth_key"] = str(b["doods_auth_key"]).strip()
                if "doods_confidence" in b:
                    c["doods_confidence"] = to_int(b.get("doods_confidence"), 1, 99, 50)
                save(c)
            return self.send(200, {"ok": True, "storage_dir": c["storage_dir"]})

        if self.command == "GET" and path == "/api/diskspace":
            with DISK_LOCK:
                return self.send(200, dict(DISK))

        if self.command == "GET" and path == "/api/status":
            c = load()
            out = {}
            for t in c["timelapses"]:
                tid = t["id"]
                r = rt_get(tid)
                try:
                    fc = len([n for n in os.listdir(os.path.join(frames_root(), tid)) if n.endswith(".jpg")])
                except OSError:
                    fc = 0
                out[tid] = {"status": r["status"], "last_capture_ts": r["last_capture_ts"],
                            "frame_count": fc, "rendering": r["rendering"]}
            # Klucz "_sun" nie koliduje z żadnym prawdziwym id timelapse'u (id-eki to
            # secrets.token_hex(4), same znaki hex, bez podkreślnika) - bezpieczny sposób na
            # dorzucenie diagnostyki okna dzień/noc bez zmiany kształtu reszty odpowiedzi.
            out["_sun"] = sun_status()
            return self.send(200, out)

        if self.command == "POST" and path == "/api/timelapses":
            b = self.body_json()
            name = str(b.get("name", "")).strip()[:60] or "Timelapse"
            url = str(b.get("rtsp_url", "")).strip()
            if not url.lower().startswith("rtsp://"):
                raise ValueError("adres musi zaczynać się od rtsp://")
            tid = secrets.token_hex(4)
            with CONF_LOCK:
                c = load()
                c["timelapses"].append({
                    "id": tid, "name": name, "rtsp_url": url,
                    "transport": "udp" if str(b.get("transport")) == "udp" else "tcp",
                    "interval_sec": to_int(b.get("interval_sec"), 5, 86400, 300),
                    "render_time": to_time(b.get("render_time"), "00:05"),
                    "render_fps": to_fps(b.get("render_fps"), 24),
                    "frame_days": to_int(b.get("frame_days"), 1, 365, 3),
                    "video_days": to_int(b.get("video_days"), 0, 3650, 90),
                    "capture_window": to_window(b.get("capture_window"), "always"),
                    "window_start": to_time(b.get("window_start"), "20:00"),
                    "window_end": to_time(b.get("window_end"), "06:00"),
                    "person_detect": bool(b.get("person_detect")),
                    "enabled": True,
                    "last_rendered_ts": 0,
                })
                save(c)
            reconcile()
            return self.send(200, {"ok": True, "id": tid})

        ms = re.match(r"^/api/snapshot/([a-z0-9]{1,20})$", path)
        if self.command == "GET" and ms:
            fdir = os.path.join(frames_root(), ms.group(1))
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
            vdir = os.path.join(videos_root(), mv.group(1))
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

        mm = re.match(r"^/api/timelapses/([a-z0-9]{1,20})/merge-all$", path)
        if self.command == "POST" and mm:
            tid = mm.group(1)
            if not any(x["id"] == tid for x in load()["timelapses"]):
                raise KeyError(tid)
            # W osobnym wątku (jak render) - może potrwać dłużej dla dużej liczby/dużych
            # plików, więc odpowiedź HTTP wraca od razu, a panel odpytuje "rendering" w
            # /api/status (ten sam wzorzec/pole co zwykły render).
            threading.Thread(target=merge_all_videos, args=(tid,), daemon=True).start()
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
            with CONF_LOCK:
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
                if "capture_window" in b:
                    t["capture_window"] = to_window(b.get("capture_window"), t.get("capture_window", "always"))
                if "window_start" in b:
                    t["window_start"] = to_time(b.get("window_start"), t.get("window_start", "20:00"))
                if "window_end" in b:
                    t["window_end"] = to_time(b.get("window_end"), t.get("window_end", "06:00"))
                if "person_detect" in b:
                    t["person_detect"] = bool(b["person_detect"])
                if "enabled" in b:
                    t["enabled"] = bool(b["enabled"])
                save(c)
            reconcile()
            return self.send(200, {"ok": True})

        if self.command == "DELETE" and m:
            with CONF_LOCK:
                c = load()
                before = len(c["timelapses"])
                c["timelapses"] = [x for x in c["timelapses"] if x["id"] != m.group(1)]
                if len(c["timelapses"]) == before:
                    raise KeyError(m.group(1))
                save(c)
            reconcile()
            for base in (frames_root(), videos_root()):
                shutil.rmtree(os.path.join(base, m.group(1)), ignore_errors=True)
            shutil.rmtree(os.path.join(MEDIA_DIR, m.group(1)), ignore_errors=True)
            with RUNTIME_LOCK:
                RUNTIME.pop(m.group(1), None)
            return self.send(200, {"ok": True})

        mf = re.match(r"^/api/videos/([a-z0-9]{1,20})/([^/]+)$", path)
        if self.command in ("GET", "HEAD") and mf and FILE_RE.match(mf.group(2)):
            p = os.path.join(videos_root(), mf.group(1), mf.group(2))
            if not os.path.isfile(p):
                raise KeyError(mf.group(2))
            return self._serve_video(p)

        if self.command == "DELETE" and mf and FILE_RE.match(mf.group(2)):
            p = os.path.join(videos_root(), mf.group(1), mf.group(2))
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


class _QuietHTTPServer(ThreadingHTTPServer):
    """Zwykły ThreadingHTTPServer z jedną różnicą: nie zaśmieca logu (stderr) pełnym
    tracebackiem za każdym razem, gdy klient (przeglądarka albo proxy Ingress HA) po prostu
    zamknie połączenie w trakcie żądania - ConnectionResetError/BrokenPipeError to normalne,
    nieszkodliwe zdarzenie (np. ktoś zamknął kartę albo odświeżył panel w złym momencie), nie
    błąd dodatku. Każdy inny wyjątek nadal dostaje pełny traceback jak domyślnie - to by
    ukryło prawdziwy błąd."""

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)


def _bind_server(retries=10, delay=2):
    """host_network: true (dodane w 1.1.0, żeby dodatek widział kamery w sieci LAN - patrz
    komentarz w config.yaml) oznacza, że port jest teraz prawdziwym gniazdem na hoście, nie
    odizolowaną siecią kontenera. Przy restarcie/aktualizacji bywa krótka chwila, w której
    poprzedni proces dodatku jeszcze nie zwolnił portu, a nowy już próbuje się na niego
    zbindować - bez tej pętli to kończyło się od razu crashem (OSError: Address in use) i
    całym dodatkiem nie startującym, zamiast po prostu chwilę zaczekać."""
    for attempt in range(1, retries + 1):
        try:
            srv = _QuietHTTPServer(("0.0.0.0", PORT), Handler)
            srv.daemon_threads = True
            return srv
        except OSError as e:
            if e.errno != 98:   # 98 = Address already in use
                raise
            if attempt == retries:
                # Po tylu próbach i tylu sekundach to już nie jest chwilowy wyścig przy
                # restarcie (ten się rozwiązuje w ciągu sekund) - coś INNEGO na tym
                # komputerze trwale trzyma ten port. Skoro host_network: true robi z niego
                # prawdziwy port hosta, może to być cokolwiek: inny dodatek z
                # host_network, albo zupełnie niezwiązany proces na tej maszynie.
                log("port %d jest zajęty na trwale (nie tylko tuż po restarcie) - "
                    "prawdopodobnie inny proces na tym komputerze używa tego samego portu. "
                    "Sprawdź przez dodatek Terminal/SSH: `ss -tlnp | grep %d` (albo "
                    "`netstat -tlnp | grep %d`), żeby zobaczyć, co go zajmuje." %
                    (PORT, PORT, PORT))
                raise
            log("port %d jest jeszcze zajęty (zwykle poprzedni proces dodatku kończy "
                "działanie po restarcie) - czekam i próbuję ponownie (%d/%d)…" %
                (PORT, attempt, retries))
            time.sleep(delay)


def _debug_log_env_once():
    """Diagnostyka SUPERVISOR_TOKEN: Supervisor (wg `ha addons info`) ma ustawione
    hassio_api: true i homeassistant_api: true dla tego dodatku, a mimo to token nie
    dociera do procesu wg SUPERVISOR_TOKEN/HASSIO_TOKEN. Zamiast zgadywać dalej, logujemy
    przy starcie same NAZWY zmiennych środowiskowych (nigdy wartości - mogłyby tam być
    sekrety) plus jawnie długość tokenu (0 = brak/pusty), żeby zobaczyć co naprawdę widzi
    proces Pythona w kontenerze."""
    try:
        names = sorted(os.environ.keys())
        log("DIAG env: zmienne widoczne w procesie (%d): %s" % (len(names), ", ".join(names)))
        tok = os.environ.get("SUPERVISOR_TOKEN")
        tok2 = os.environ.get("HASSIO_TOKEN")
        log("DIAG env: SUPERVISOR_TOKEN obecny=%s dlugosc=%d | HASSIO_TOKEN obecny=%s dlugosc=%d"
            % (tok is not None, len(tok or ""), tok2 is not None, len(tok2 or "")))
    except Exception as e:
        log("DIAG env: blad podczas logowania (%s)" % e)


def main():
    _debug_log_env_once()
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(frames_root(), exist_ok=True)
    os.makedirs(videos_root(), exist_ok=True)
    os.makedirs(RUN_DIR, exist_ok=True)
    reconcile()
    threading.Thread(target=render_worker_loop, daemon=True).start()
    threading.Thread(target=cleanup_loop, daemon=True).start()
    threading.Thread(target=sun_loop, daemon=True).start()
    threading.Thread(target=diskspace_loop, daemon=True).start()
    srv = _bind_server()
    log("Timelapse RTSP: panel na porcie %d, timelapse'y: %d" % (PORT, len(load()["timelapses"])))
    srv.serve_forever()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *a: os._exit(0))
    main()
