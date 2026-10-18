## 1.3.0
- **Zasilanie kiosków:** przy każdym kiosku „Ustaw zasilanie…” — przekaźnik (encja HA: switch/light/input_boolean,
  np. ESP32 / Sonoff) i Wake-on-LAN (adres MAC albo encja WOL). Przyciski **Włącz** (przekaźnik, potem pakiety WOL
  do skutku) i **Wyłącz** (kiosk zamyka system, potem przekaźnik odcina prąd); „Włącz / Wyłącz wszystkie”.
- MAC wpisuje się sam z kiosku (kiosk-setup 1.0.17+), zapamiętany do WOL, gdy kiosk jest wyłączony.
- Na karcie kiosku „Wyłączenie za …”, gdy zaplanowano automatyczne wyłączenie.
- Dodatek ma dostęp do API Home Assistant (`homeassistant_api`) — do przekaźników i WOL.

## 1.2.1
- Naprawa szukania w tle: token Supervisora czytany też z /run/s6/container_environment (s6-overlay nie przekazuje go do procesu), więc dodatek zna sieci HA i znajduje nowe kioski.
- Komunikat o braku tokenu tylko raz, a nie co 2 minuty.

## 1.2.0
- Parowanie bez tokenu: na kiosku „Paruj z HA” (kiosk-setup 1.0.15+), dodatek doda go sam.
- Szukanie kiosków w tle co 2 minuty; lista w panelu odświeża się sama.

## 1.1.0
- Wersje kiosków: przy każdym kiosku „aktualna” albo „↑ dostępna X” i przycisk „Aktualizuj do X” (z GitHuba).
- „Aktualizuj wszystkie z GitHuba” w sekcji Wszystkie kioski naraz.
- Pasek z informacją, gdy w repozytorium jest nowsza wersja dodatku.

## 1.0.1
- Pierwsze wydanie: lista kiosków z wyszukiwaniem w sieci, stan każdego kiosku, panel kiosku
  otwierany w Home Assistant (Ingress), akcje na wszystkie kioski naraz (komunikat, dymek, widok,
  ekrany, aktualizacja). Architektury aarch64 i amd64.
