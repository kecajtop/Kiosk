# Zmiany

## 1.0.6 (2026-10-17)
- **Wi-Fi:** zakładka Połączenia → Wi-Fi i sieć — stan kart, skanowanie sieci, połączenie (DHCP albo stały adres)
  z automatycznym cofnięciem po 2 min bez potwierdzenia; oszczędzanie energii Wi-Fi wyłączone (kiosk zawsze
  osiągalny); `wpasupplicant` i `iw` w zależnościach; stan Wi-Fi w Diagnostyce.
- **Aktualizacje:** „Aktualizuj z GitHuba (wydanie)” bez ustawiania adresu oraz „Aktualizuj z gita (najnowszy kod)” —
  kiosk pobiera kod z gałęzi main, sam buduje pakiet swojej edycji i instaluje (`kiosk-update github`, `kiosk-update git`).
- Gotowe pakiety: `releases/kiosk-setup_1.0.6_amd64.deb`, `releases/kiosk-setup-light_1.0.6_amd64.deb`.

## 1.0.5 (2026-10-16)
- **Wersja light** — pakiet `kiosk-setup-light` (ok. 0,3 MB): ekran (Chromium, kamery RTSP, USB), wszystkie
  zegary i widoki, panel WWW, MQTT/Home Assistant, automatyka ekranu, aktualizacje i muzyka (MPD, radio, DLNA).
  Bez mowy (Piper, espeak), mówiącego zegara, interkomu i asystenta głosowego. Zastępuje pełny pakiet i odwrotnie.
- Aktualizacje z GitHuba osobno dla każdej edycji: `update.json` (pełna) i `update-light.json` (light);
  kiosk nie zmienia edycji automatycznie.

## 1.0.4 (2026-10-16)
- **Mimika oczu:** słownik ok. 350 słów i fraz po polsku i angielsku (powitania, posiłki, pogoda, alarmy,
  goście i przesyłki, przypomnienia, pora snu, upomnienia). Dopasowanie od początku słowa, wygrywa nastrój
  z największą liczbą trafień.

## 1.0.3 (2026-10-16)
- **Nowe wyglądy zegara:** Oczy robota z zegarem, Same oczy robota, Zegar słowny (PL), Zegar słowny (EN),
  Zegar radiowy (LCD), Kod czasu DCF77, LED z pierścieniem.
- **Mimika podczas mowy:** gdy kiosk mówi, oczy patrzą na rozmówcę, pulsują w rytm głosu i przybierają
  wyraz pasujący do treści komunikatu.

## 1.0.2 (2026-10-16)
- **kiosk-setup 1:1.0.2** — nowe wyglądy zegara: **Oczy z zegarem** (para oczu rozgląda się, mruga
  i zerka na godzinę przy zmianie minuty) i **Same oczy** (bez godziny).

## 1.0.1 (2026-10-16)
Pierwsze wydanie.

- **kiosk-setup 1:1.0.1** — wszystkie funkcje kiosku opisane w [docs/DOKUMENTACJA.md](docs/DOKUMENTACJA.md),
  w tym aktualizacje z GitHuba (`update.json` z wersją, adresem i sumą SHA-256).
- **Dodatek HA „Kioski” 1.0.1** — panel wszystkich kiosków w Home Assistant.
