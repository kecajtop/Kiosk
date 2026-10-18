#!/usr/bin/env python3
"""Kioski — dodatek Home Assistant: jeden panel do wszystkich kiosków kiosk-setup.

Działa przez Ingress (panel w menu bocznym HA, logowanie kontem HA). Lista
kiosków i ich tokeny są w /data/kiosks.json (tylko w dodatku). Panel każdego
kiosku jest dostępny przez pośrednika /k/<id>/ — dodatek dokleja token kiosku,
więc nie trzeba logować się do kiosków osobno.
"""
import http.client
import ipaddress
import json
import os
import re
import secrets
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("KM_PORT", "8099"))
DATA = os.environ.get("KM_DATA", "/data")
STORE = os.path.join(DATA, "kiosks.json")
APP_DIR = os.path.dirname(os.path.abspath(__file__))
INGRESS_ONLY = os.environ.get("KM_ANY_CLIENT") != "1"
INGRESS_GW = "172.30.32.2"
HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers",
       "transfer-encoding", "upgrade", "x-frame-options", "www-authenticate", "content-length"}
HOST_RE = re.compile(r"^[A-Za-z0-9.\-]{1,253}$")
MAC_RE = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$")
ENTITY_RE = re.compile(r"^(switch|light|input_boolean|button|script)\.[a-z0-9_]{1,200}$")
LOCK = threading.Lock()
ADDON_VERSION = "1.3.1"          # = version w config.yaml
RAW = "https://raw.githubusercontent.com/kecajtop/Kiosk/main/"
_LATEST = {"t": 0, "data": None}


def latest_versions():
    """Najnowsze wydania z GitHuba: kiosk-setup (pełna/light) i ten dodatek — pamiętane 1 h."""
    if _LATEST["data"] and time.time() - _LATEST["t"] < 3600:
        return _LATEST["data"]
    out = {"addon_installed": ADDON_VERSION}
    for key, f in (("full", "update.json"), ("light", "update-light.json")):
        try:
            with urllib.request.urlopen(RAW + f, timeout=10) as r:
                j = json.load(r)
            out[key] = j.get("version", "")
            out[key + "_notes"] = j.get("notes", "")
        except Exception as e:
            log("najnowsza wersja (%s): %s" % (f, e))
    try:
        with urllib.request.urlopen(RAW + "kiosk_manager/config.yaml", timeout=10) as r:
            m = re.search(r'^version:\s*"?([^"\s]+)', r.read().decode("utf-8", "replace"), re.M)
        out["addon"] = m.group(1) if m else ""
    except Exception as e:
        log("najnowsza wersja dodatku: %s" % e)
    _LATEST.update(t=time.time(), data=out)
    return out


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)


def load():
    try:
        with open(STORE) as f:
            d = json.load(f)
        return d if isinstance(d, list) else []
    except FileNotFoundError:
        return []
    except Exception as e:
        log("kiosks.json: %s" % e)
        return []


def save(kiosks):
    os.makedirs(DATA, exist_ok=True)
    tmp = STORE + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(kiosks, f, ensure_ascii=False, indent=1)
    os.replace(tmp, STORE)


def find(kid):
    for k in load():
        if k["id"] == kid:
            return k
    return None


def kiosk_request(k, method, path, body=None, headers=None, timeout=10):
    c = http.client.HTTPConnection(k["host"], int(k.get("port", 8088)), timeout=timeout)
    h = {"Authorization": "Bearer " + k["token"]}
    h.update(headers or {})
    c.request(method, path, body=body, headers=h)
    return c, c.getresponse()


def kiosk_json(k, method, path, payload=None, timeout=10):
    body = json.dumps(payload).encode() if payload is not None else None
    c, r = kiosk_request(k, method, path, body, {"Content-Type": "application/json"} if body else {}, timeout)
    try:
        data = r.read()
        try:
            j = json.loads(data or b"{}")
        except ValueError:
            j = {"error": "kiosk odpowiedział %d" % r.status}
        if r.status >= 400:
            raise RuntimeError(j.get("error") or "błąd %d" % r.status)
        return j
    finally:
        c.close()


def ping(host, port=8088, timeout=0.8):
    try:
        with urllib.request.urlopen("http://%s:%d/api/ping" % (host, port), timeout=timeout) as r:
            j = json.loads(r.read(4096))
        if isinstance(j, dict) and j.get("kecaj"):
            return {"host": host, "port": port, "name": j.get("name", ""), "hostname": j.get("hostname", ""),
                    "version": j.get("version", ""), "pair": bool(j.get("pair"))}
    except Exception:
        pass
    return None


def supervisor_token():
    """s6-overlay (/init z obrazu bazowego) nie przekazuje zmiennych kontenera do CMD — czytamy też z pliku."""
    tok = os.environ.get("SUPERVISOR_TOKEN") or os.environ.get("HASSIO_TOKEN")
    for name in ("SUPERVISOR_TOKEN", "HASSIO_TOKEN"):
        if tok:
            break
        try:
            with open("/run/s6/container_environment/" + name) as f:
                tok = f.read().strip()
        except OSError:
            pass
    return tok


_NO_TOKEN_LOGGED = False


def local_networks():
    """Sieci do przeszukania: z Supervisora (interfejsy HA), inaczej z adresów znanych kiosków."""
    global _NO_TOKEN_LOGGED
    nets = []
    tok = supervisor_token()
    if tok:
        try:
            req = urllib.request.Request("http://supervisor/network/info", headers={"Authorization": "Bearer " + tok})
            with urllib.request.urlopen(req, timeout=5) as r:
                info = json.load(r)["data"]
            for itf in info.get("interfaces", []):
                for a in (itf.get("ipv4") or {}).get("address", []) or []:
                    n = ipaddress.ip_interface(a).network
                    if n.prefixlen < 22:
                        n = ipaddress.ip_interface(a.split("/")[0] + "/24").network
                    if not n.is_loopback and str(n) not in [str(x) for x in nets]:
                        nets.append(n)
        except Exception as e:
            log("network/info (Supervisor): %s" % e)
    elif not _NO_TOKEN_LOGGED:
        _NO_TOKEN_LOGGED = True
        log("brak SUPERVISOR_TOKEN — sieci tylko z listy kiosków albo wpisane ręcznie")
    for k in load():
        try:
            n = ipaddress.ip_interface(socket.gethostbyname(k["host"]) + "/24").network
            if n not in nets:
                nets.append(n)
        except Exception:
            pass
    return nets


def scan(extra=None, quiet=False):
    nets = local_networks()
    if extra:
        n = ipaddress.ip_network(extra, strict=False)
        if n.num_addresses > 1024:
            raise ValueError("sieć za duża — najwyżej /22, np. 192.168.0.0/24")
        nets.insert(0, n)
    hosts = []
    for n in nets:
        hosts += [str(h) for h in n.hosts()]
    known = {k["host"] for k in load()}
    if not quiet:
        log("szukam kiosków: sieci %s (%d adresów, port 8088)" % (", ".join(str(n) for n in nets) or "brak", len(hosts)))
    with ThreadPoolExecutor(64) as ex:
        found = [r for r in ex.map(ping, hosts) if r]
    if not quiet:
        log("znalezione kioski: %s" % (", ".join(f["host"] for f in found) or "brak"))
    for f in found:
        f["known"] = f["host"] in known
        if f["pair"]:   # administrator kliknął na kiosku „Paruj z HA” — dodajemy sami
            try:
                f["paired"] = pair_claim(f["host"], f["port"])["output"]
                f["known"] = True
            except Exception as e:
                f["pair_error"] = str(e)
                log("parowanie %s: %s" % (f["host"], e))
    return {"networks": [str(n) for n in nets], "found": found}


def pair_claim(host, port=8088):
    """Token z kiosku z otwartym parowaniem (POST /api/pair/claim), potem zwykłe dodanie do listy."""
    req = urllib.request.Request("http://%s:%d/api/pair/claim" % (host, port),
                                 json.dumps({"name": "Home Assistant (Kioski)"}).encode(),
                                 {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            j = json.loads(r.read(65536) or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(json.loads(e.read(4096) or b"{}").get("error") or "kiosk odpowiedział %d" % e.code)
    if not j.get("token"):
        raise RuntimeError("kiosk nie oddał tokenu")
    out = add_kiosk({"host": host, "port": port, "token": j["token"]})
    log("sparowano: %s" % out["output"])
    return out


def auto_scan():
    """W tle co 2 minuty: kioski z otwartym parowaniem trafiają na listę same, MAC-i kiosków do WOL."""
    while True:
        time.sleep(120)
        try:
            scan(quiet=True)
        except Exception as e:
            log("szukanie w tle: %s" % e)
        for k in load():    # MAC z włączonych kiosków — do WOL, gdy będą wyłączone
            try:
                remember_mac(k["id"], (kiosk_json(k, "GET", "/api/status", timeout=5).get("network_hw") or {}).get("mac"))
            except Exception:
                pass


def ha_call(method, path, payload=None, timeout=10):
    """Home Assistant Core przez Supervisora (homeassistant_api: true)."""
    tok = supervisor_token()
    if not tok:
        raise RuntimeError("brak tokenu Supervisora — dodatek nie może sterować encjami HA")
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request("http://supervisor/core/api" + path, body, method=method,
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raise RuntimeError("Home Assistant: %s %s — %d %s" % (method, path, e.code, e.read(300).decode("utf-8", "replace")))


def ha_entity_service(entity, on):
    """Włącz/wyłącz encję; button i script tylko „naciskamy” przy włączaniu."""
    domain = entity.split(".", 1)[0]
    if domain == "button":
        if on:
            ha_call("POST", "/services/button/press", {"entity_id": entity})
    elif domain == "script":
        if on:
            ha_call("POST", "/services/script/turn_on", {"entity_id": entity})
    else:
        ha_call("POST", "/services/homeassistant/turn_%s" % ("on" if on else "off"), {"entity_id": entity})


def ha_power_entities():
    """Encje do wyboru w ustawieniach zasilania: przekaźniki (switch/light/input_boolean) i WOL (switch/button/script)."""
    out = []
    for st in ha_call("GET", "/states") or []:
        e = st.get("entity_id", "")
        if ENTITY_RE.match(e):
            out.append({"entity_id": e, "name": st.get("attributes", {}).get("friendly_name") or e, "state": st.get("state")})
    out.sort(key=lambda x: x["entity_id"])
    return out


def set_power(kid, body):
    relay = str(body.get("relay") or "").strip()
    wol = str(body.get("wol") or "").strip()
    if relay and not (ENTITY_RE.match(relay) and relay.split(".")[0] in ("switch", "light", "input_boolean")):
        raise ValueError("przekaźnik: encja switch., light. albo input_boolean., np. switch.kiosk_relay")
    if wol and not (MAC_RE.match(wol) or ENTITY_RE.match(wol)):
        raise ValueError("WOL: adres MAC (AA:BB:CC:DD:EE:FF) albo encja, np. switch.kiosk_wol")
    with LOCK:
        ks = load()
        for k in ks:
            if k["id"] == kid:
                k["power"] = {"relay": relay, "wol": wol.upper().replace("-", ":") if MAC_RE.match(wol) else wol}
                save(ks)
                return {"output": "Zapisano zasilanie: %s" % k["host"]}
    raise KeyError(kid)


def _wol(wol):
    if MAC_RE.match(wol):
        ha_call("POST", "/services/wake_on_lan/send_magic_packet", {"mac": wol})
    else:
        ha_entity_service(wol, True)


def _power_on_job(k, pw):
    try:
        if pw.get("relay"):
            ha_entity_service(pw["relay"], True)
            time.sleep(8)       # zasilacz i karta sieciowa muszą wstać, zanim WOL zadziała
        if pw.get("wol"):
            for _ in range(3):  # kilka pakietów — pierwszy bywa gubiony tuż po podaniu zasilania
                _wol(pw["wol"])
                for _ in range(10):
                    time.sleep(2)
                    if ping(k["host"], int(k.get("port", 8088)), 1.5):
                        log("włączono: %s" % k["host"])
                        return
    except Exception as e:
        log("włączanie %s: %s" % (k["host"], e))


def _power_off_job(k, pw, shut_ok):
    try:
        if shut_ok:     # czekamy, aż system się zamknie, dopiero potem odcinamy prąd
            for _ in range(60):
                time.sleep(3)
                if not ping(k["host"], int(k.get("port", 8088)), 1.5):
                    break
            time.sleep(15)
        ha_entity_service(pw["relay"], False)
        log("odcięto zasilanie: %s (%s)" % (k["host"], pw["relay"]))
    except Exception as e:
        log("wyłączanie %s: %s" % (k["host"], e))


def remember_mac(kid, mac):
    """MAC zgłoszony przez włączony kiosk — zapisany jako WOL, jeśli nic innego nie ustawiono."""
    if not MAC_RE.match(mac or ""):
        return
    with LOCK:
        ks = load()
        for k in ks:
            if k["id"] == kid and not (k.get("power") or {}).get("wol"):
                k["power"] = dict(k.get("power") or {"relay": ""}, wol=mac.upper())
                save(ks)
                log("zapamiętano MAC %s: %s" % (k["host"], mac))


def power_on(kid):
    k = find(kid)
    if not k:
        raise KeyError(kid)
    pw = k.get("power") or {}
    if not (pw.get("relay") or pw.get("wol")):
        raise ValueError("kiosk %s nie ma ustawionego zasilania (przekaźnik / WOL)" % k["host"])
    threading.Thread(target=_power_on_job, args=(k, pw), daemon=True).start()
    what = " + ".join(x for x in ("przekaźnik" if pw.get("relay") else "", "WOL" if pw.get("wol") else "") if x)
    return {"output": "Włączam %s (%s) — kiosk wstanie za 1–2 minuty" % (k["host"], what)}


def power_off(kid):
    k = find(kid)
    if not k:
        raise KeyError(kid)
    pw = k.get("power") or {}
    try:
        kiosk_json(k, "POST", "/api/shutdown", {"in_minutes": 0}, timeout=5)
        shut_ok = True
    except Exception as e:
        if not pw.get("relay"):
            raise RuntimeError("kiosk %s nie odpowiada (%s)" % (k["host"], e))
        shut_ok = False
    if pw.get("relay"):
        threading.Thread(target=_power_off_job, args=(k, pw, shut_ok), daemon=True).start()
        return {"output": "Wyłączam %s — przekaźnik odetnie prąd %s" % (
            k["host"], "po zamknięciu systemu" if shut_ok else "teraz (kiosk nie odpowiada)")}
    return {"output": "Wyłączam %s" % k["host"]}


def add_kiosk(body):
    host = str(body.get("host") or "").strip()
    token = str(body.get("token") or "").strip()
    port = int(body.get("port") or 8088)
    if not HOST_RE.match(host):
        raise ValueError("podaj adres kiosku, np. 192.168.0.214")
    if not token or len(token) > 200:
        raise ValueError("podaj token kiosku (na kiosku: sudo kiosk-mode api-token)")
    k = {"id": "", "host": host, "port": port, "token": token}
    try:
        me = kiosk_json(k, "GET", "/api/me", timeout=5)
    except (OSError, socket.timeout) as e:
        raise RuntimeError("kiosk %s nie odpowiada (%s)" % (host, e))
    except RuntimeError as e:
        raise RuntimeError("kiosk odrzucił token: %s" % e)
    if me.get("role") != "admin":
        raise RuntimeError("token nie daje uprawnień administratora — użyj tokenu z sudo kiosk-mode api-token")
    st = kiosk_json(k, "GET", "/api/status", timeout=5)
    with LOCK:
        ks = load()
        for old in ks:
            if old["host"] == host and int(old.get("port", 8088)) == port:
                old["token"] = token
                save(ks)
                return {"output": "Zaktualizowano token: Kiosk %s" % st.get("name", host), "id": old["id"]}
        k["id"] = "k" + secrets.token_hex(4)
        ks.append(k)
        save(ks)
    return {"output": "Dodano: Kiosk %s (%s)" % (st.get("name") or st.get("hostname", host), host), "id": k["id"]}


def remove_kiosk(kid):
    with LOCK:
        ks = load()
        n = [k for k in ks if k["id"] != kid]
        if len(n) == len(ks):
            raise KeyError(kid)
        save(n)


BACK_BAR = (b'<a href="../../" style="position:fixed;right:12px;bottom:12px;z-index:9;background:#F2A900;'
            b'color:#14110A;font:600 14px system-ui,sans-serif;padding:10px 14px;border-radius:999px;'
            b'text-decoration:none;box-shadow:0 2px 10px #0008">&larr; Wszystkie kioski</a>')


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "kiosk-manager"

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

    def chunked(self):
        return "chunked" in (self.headers.get("Transfer-Encoding") or "").lower()

    def read_body(self, limit):
        """Treść zapytania — z Content-Length albo w kawałkach (Ingress HA wysyła strumieniem: chunked)."""
        self.body_read = True
        if self.chunked():
            out = bytearray()
            while True:
                line = self.rfile.readline(1024)
                if not line:
                    break
                size = int(line.split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    while self.rfile.readline(1024) not in (b"\r\n", b"\n", b""):
                        pass
                    break
                out += self.rfile.read(size)
                self.rfile.readline(8)
                if len(out) > limit:
                    raise ValueError("za duże zapytanie")
            return bytes(out)
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError("za duże zapytanie")
        return self.rfile.read(n) if n else b""

    def body_json(self):
        raw = self.read_body(1_000_000) or b"{}"
        try:
            return json.loads(raw or b"{}")
        except ValueError:
            raise ValueError("błędny JSON")

    def route(self):
        self.body_read = False
        try:
            self._route()
        finally:
            # Nieodczytana treść (np. błąd przed odczytem) zepsułaby następne zapytanie na tym połączeniu.
            has_body = self.chunked() or int(self.headers.get("Content-Length") or 0) > 0
            if has_body and not self.body_read:
                self.close_connection = True

    def _route(self):
        if not self.allowed():
            return self.send(403, {"error": "tylko przez Home Assistant (Ingress)"})
        path = self.path.split("?", 1)[0]
        m = re.match(r"^/k/([a-z0-9]{1,20})(/.*)?$", self.path)
        if m:
            return self.proxy(m.group(1), m.group(2))
        try:
            fm = re.match(r"^/font/plex-mono-(400|500|600)\.ttf$", path)
            if self.command == "GET" and fm:
                name = {"400": "Regular", "500": "Medium", "600": "SemiBold"}[fm.group(1)]
                with open(os.path.join(APP_DIR, "fonts", "IBMPlexMono-%s.ttf" % name), "rb") as f:
                    return self.send(200, f.read(), "font/ttf")
            if self.command == "GET" and path in ("/", "/index.html"):
                with open(os.path.join(APP_DIR, "index.html"), "rb") as f:
                    return self.send(200, f.read(), "text/html; charset=utf-8")
            if self.command == "GET" and path == "/api/latest":
                return self.send(200, latest_versions())
            if self.command == "GET" and path == "/api/kiosks":
                return self.send(200, {"kiosks": [{"id": k["id"], "host": k["host"], "port": k.get("port", 8088),
                                                   "power": k.get("power") or {}} for k in load()]})
            if self.command == "GET" and path == "/api/ha/entities":
                return self.send(200, {"entities": ha_power_entities()})
            mp = re.match(r"^/api/kiosks/([a-z0-9]{1,20})/(power|on|off)$", path)
            if self.command == "POST" and mp:
                body = self.body_json()
                if mp.group(2) == "power":
                    return self.send(200, dict(set_power(mp.group(1), body), ok=True))
                return self.send(200, dict((power_on if mp.group(2) == "on" else power_off)(mp.group(1)), ok=True))
            if self.command == "POST" and path == "/api/kiosks":
                return self.send(200, dict(add_kiosk(self.body_json()), ok=True))
            m2 = re.match(r"^/api/kiosks/([a-z0-9]{1,20})$", path)
            if self.command == "DELETE" and m2:
                remove_kiosk(m2.group(1))
                return self.send(200, {"ok": True, "output": "Usunięto z listy"})
            if self.command == "POST" and path == "/api/scan":
                return self.send(200, scan(self.body_json().get("network") or None))
            return self.send(404, {"error": "nie znaleziono"})
        except KeyError:
            return self.send(404, {"error": "nie ma takiego kiosku"})
        except (ValueError, RuntimeError) as e:
            return self.send(400, {"error": str(e)})
        except Exception as e:
            log("błąd %s %s: %r" % (self.command, path, e))
            return self.send(500, {"error": str(e)})

    def proxy(self, kid, rest):
        k = find(kid)
        if not k:
            return self.send(404, {"error": "nie ma takiego kiosku"})
        if not rest:
            self.send_response(301)
            self.send_header("Location", kid + "/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        body = None
        if self.chunked():
            # Kiosk przyjmuje tylko Content-Length — strumień z Ingress składamy w całość.
            try:
                body = self.read_body(150_000_000)
            except ValueError:
                return self.send(413, {"error": "plik za duży"})
            n = len(body)
        else:
            n = int(self.headers.get("Content-Length") or 0)
        if n > 150_000_000:
            return self.send(413, {"error": "plik za duży"})
        fwd = {h: self.headers[h] for h in ("Content-Type", "Range", "Accept", "If-None-Match") if self.headers.get(h)}
        if n:
            fwd["Content-Length"] = str(n)
        try:
            c = http.client.HTTPConnection(k["host"], int(k.get("port", 8088)), timeout=900)
            c.putrequest(self.command, rest, skip_accept_encoding=True)
            c.putheader("Authorization", "Bearer " + k["token"])
            for h, v in fwd.items():
                c.putheader(h, v)
            c.endheaders()
            self.body_read = True
            if body is not None:
                c.send(body)
            left = n if body is None else 0
            while left > 0:     # przesyłanie pliku (zdjęcia, aktualizacja) bez trzymania w pamięci
                chunk = self.rfile.read(min(left, 1 << 16))
                if not chunk:
                    break
                c.send(chunk)
                left -= len(chunk)
            r = c.getresponse()
        except (OSError, socket.timeout, http.client.HTTPException) as e:
            return self.send(502, {"error": "kiosk %s nie odpowiada: %s" % (k["host"], e)})
        try:
            ctype = r.getheader("Content-Type", "")
            inject = self.command == "GET" and rest.split("?")[0] == "/" and ctype.startswith("text/html")
            self.send_response(r.status)
            for h, v in r.getheaders():
                if h.lower() not in HOP:
                    self.send_header(h, v)
            if inject:
                body = r.read().replace(b"<body>", b"<body>" + BACK_BAR, 1)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            length = r.getheader("Content-Length")
            if length is not None:
                self.send_header("Content-Length", length)
            else:
                self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            if self.command == "HEAD":
                return
            while True:
                chunk = r.read(1 << 16)
                if not chunk:
                    break
                if length is None:
                    self.wfile.write(b"%x\r\n%s\r\n" % (len(chunk), chunk))
                else:
                    self.wfile.write(chunk)
            if length is None:
                self.wfile.write(b"0\r\n\r\n")
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            c.close()

    do_GET = do_POST = do_DELETE = do_PUT = do_HEAD = route


def main():
    os.makedirs(DATA, exist_ok=True)
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    log("Kioski: panel na porcie %d, kiosków: %d" % (PORT, len(load())))
    threading.Thread(target=auto_scan, daemon=True).start()
    srv.serve_forever()


if __name__ == "__main__":
    sys.exit(main())
