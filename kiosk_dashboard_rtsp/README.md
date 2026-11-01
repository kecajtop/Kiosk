# Dashboard RTSP

Dodatek Home Assistant, który zamienia wybrane dashboardy/widoki Lovelace w kamery RTSP —
do obejrzenia w NVR-ze (Frigate, go2rtc, Synology Surveillance Station...), w `kiosk-setup`
(tryb `rtsp`/`mix`) albo w dowolnym odtwarzaczu obsługującym RTSP (VLC).

## Jak to działa

Dla każdego skonfigurowanego dashboardu dodatek uruchamia osobny, niewidoczny „ekran”
(Xvfb) z przeglądarką Chromium w trybie kiosk, zalogowaną bezobsługowo przy pomocy
długoterminowego tokenu Home Assistant (bez pokazywania ekranu logowania). `ffmpeg`
przechwytuje ten ekran i publikuje gotowy strumień H.264 do wbudowanego serwera RTSP
(MediaMTX), który serwuje go dalej — każdy dashboard pod osobną ścieżką na porcie 8554.

## Instalacja

1. Dodaj repozytorium `https://github.com/kecajtop/Kiosk` w Home Assistant: Ustawienia →
   Dodatki → sklep z dodatkami → ⋮ → Repozytoria.
2. Zainstaluj dodatek **Dashboard RTSP**, uruchom.
3. Otwórz panel dodatku (ikona w menu bocznym HA).
4. Ustawienia → wklej adres HA (zwykle `http://homeassistant:8123` działa od razu wewnątrz
   sieci dodatków) i długoterminowy token (profil użytkownika HA → Zabezpieczenia →
   „Utwórz token długoterminowy”).
5. Dodaj dashboard: nazwa, ścieżka (np. `/lovelace-salon/0`), rozdzielczość, kl./s.
6. Gotowy strumień: `rtsp://<adres-HA>:8554/<id-dashboardu>` (id widoczne w panelu obok
   nazwy).

Zobacz też [DOCS.md](DOCS.md).
