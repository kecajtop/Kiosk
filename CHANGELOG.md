# Zmiany

## 1.0.21 (2026-10-25)
- **Kalendarz bez Home Assistant:** Ustawienia → Kalendarz — nowe pole na tajne linki iCal (.ics), np. z Google
  Calendar (Ustawienia kalendarza → Scalanie kalendarza → Tajny adres w formacie iCal). Kiosk pobiera je
  bezpośrednio, bez żadnej integracji w Home Assistant i bez konta dewelopera Google. Do 5 linków naraz, można
  łączyć z encjami `calendar.*` z HA. Obsługiwane są też wydarzenia cykliczne (RRULE: codziennie/co tydzień/co
  miesiąc/co rok) i wyjątki (EXDATE). Plik z linkami zapisywany teraz z uprawnieniami 600 (tylko root), bo
  zawiera tajne adresy.

## 1.0.20 (2026-10-18)
- Naprawa: gdy dpkg zostało przerwane wcześniej (np. restart w trakcie instalacji), każda kolejna aktualizacja
  kończyła się błędem „dpkg został przerwany, należy wykonać ręcznie dpkg --configure -a”, mimo ponawiania
  próby. `kiosk-update` wykrywa teraz taki stan (`dpkg --audit`) i sam kończy przerwaną konfigurację przed
  ponowną próbą instalacji.

## 1.0.19 (2026-10-18)
- Naprawa: kiosk po aktualizacji pokazywał pustą wersję (ping, panel, dodatek Kioski, encja „Aktualizacja” w HA bez
  zainstalowanej wersji). postinst restartuje kiosk-api, gdy dpkg ma pakiet jeszcze jako „half-configured” — teraz
  ta wersja też się liczy.

## 1.0.18 (2026-10-18)
- **Automatyczna jasność wg położenia słońca:** Ustawienia → Jasność i wyłączanie. Jasność rośnie o świcie i
  maleje o zmierzchu; wysokość słońca z encji `sun.sun` w Home Assistant, a bez HA — obliczona z
  szerokości/długości geograficznej (Automatyka → Pogoda). Ustawiane: jasność w nocy i w dzień (%).
- **Panel kiosku, porządek na telefonie:** opis każdej sekcji (np. „Widoki”, „Harmonogram”) schowany pod
  „ⓘ Co to jest” zamiast zajmować miejsce na stałe; w Pilocie drugorzędne przyciski ekranu (Noc teraz / wg
  godzin / Odśwież / Zakończ alarm, jasność) schowane pod „Więcej”; mniejsze przyciski pilota i kafelków radia
  na wąskim ekranie. Na karcie Kamery „Na żywo” i „Odśwież” to teraz małe przyciski z ikoną (▶ / ⟳) zamiast
  szerokich przycisków z tekstem.
- Dodatek Kioski 1.3.1: ten sam porządek w panelu dodatku — karta kiosku pokazuje dane w dwukolumnowej tabeli,
  drugorzędne przyciski (zasilanie, wyłączanie, usuwanie) pod „Więcej”, a „Wszystkie kioski naraz” jest zwijane.
  Naprawiony też błąd układu: siatki wymuszały szerokość większą niż ekran telefonu, więc tekst się ucinał.
- Gotowe pakiety: `releases/kiosk-setup_1.0.18_amd64.deb`, `releases/kiosk-setup-light_1.0.18_amd64.deb`.

## 1.0.17 (2026-10-18)
- **MAC i Wake-on-LAN w stanie kiosku:** `GET /api/status` → `network_hw` (interfejs trasy domyślnej, MAC, Wi-Fi,
  WOL z `ethtool`); w panelu kafelek „MAC”, w HA sensor diagnostyczny „Adres MAC”. Dodatek Kioski 1.3.0 bierze
  z niego adres do WOL.
- **Czas do automatycznego wyłączenia:** `shutdown_in_s` w `/api/status`, w panelu „Wyłączenie … (za X h Y min)”,
  w HA sensor „Do wyłączenia” (min).
- `ethtool` w Recommends (stan WOL karty sieciowej).
- **Dodatek Kioski 1.3.0:** włączanie i wyłączanie kiosków przekaźnikiem z HA i przez Wake-on-LAN (pojedynczo
  i wszystkie naraz); 1.2.1 — poprawione szukanie kiosków w tle (token Supervisora).
- Gotowe pakiety: `releases/kiosk-setup_1.0.17_amd64.deb`, `releases/kiosk-setup-light_1.0.17_amd64.deb`.

## 1.0.16 (2026-10-18) · aplikacja Kiosk 1.5
- **Odtwarzacz w Androidzie (aplikacja 1.5):** powiadomienie z okładką, tytułem i stacją, przyciski ⏮ ⏯ ⏭ — także na
  ekranie blokady, w słuchawkach i na zegarku. Głośność kiosku z przycisków telefonu działa też w tle i przy
  zablokowanym ekranie (jak przy Chromecaście). Włączane w ustawieniach aplikacji („Odtwarzacz w powiadomieniu”).
- **Pilot w panelu jak odtwarzacz:** okładka, tytuł, wykonawca i stacja, przyciski ⏮ ⏯ ⏭ i głośność −/+.
- **API:** `POST /api/audio/toggle` (graj/pauza — wznawia ostatnią stację), `POST /api/radio/step {"dir": 1|-1}`
  (następna/poprzednia ulubiona), `GET /api/nowplaying/art` (okładka); MQTT `radio_next/set`, `radio_prev/set`
  i przyciski „Następna stacja” / „Poprzednia stacja” w HA. Dostępne też dla kont domowników.
- Gotowe pakiety: `releases/kiosk-setup_1.0.16_amd64.deb`, `releases/kiosk-setup-light_1.0.16_amd64.deb`,
  `releases/kiosk-android-1.5.apk`.

## 1.0.15 (2026-10-18) · dodatek Kioski 1.2.0
- **Paruj z HA:** przycisk w panelu kiosku (MQTT i Home Assistant) otwiera parowanie na 5 minut — dodatek Kioski
  sam znajduje kiosk w sieci i dodaje go do listy, bez SSH i przepisywania tokenu. Jedno kliknięcie = jedno
  sparowanie; `/api/ping` mówi, czy parowanie jest otwarte. API: `POST /api/pair/open` (administrator),
  `POST /api/pair/claim` (bez logowania, tylko w otwartym oknie).
- **Dodatek Kioski 1.2.0:** szukanie kiosków w tle co 2 minuty i automatyczne parowanie.
- Gotowe pakiety: `releases/kiosk-setup_1.0.15_amd64.deb`, `releases/kiosk-setup-light_1.0.15_amd64.deb`.

## 1.0.14 (2026-10-18) · dodatek Kioski 1.1.0 · aplikacja Kiosk 1.4
- **Aktualizacje kiosku w Home Assistant:** encja „Aktualizacja” (zainstalowana i dostępna wersja, opis, postęp,
  przycisk „Zainstaluj” — kiosk widać w Ustawienia → Aktualizacje), przełącznik „Automatyczne aktualizacje”
  (nocne) i przycisk „Sprawdź aktualizacje”. Kiosk sprawdza dostępną wersję co 6 godzin. MQTT: `update/set` = `install`,
  `auto_update/set` = `ON`/`OFF`, `update_check/set`.
- **Podgląd ekranu w Home Assistant:** w panelu (Połączenia → MQTT i Home Assistant) gotowe adresy dla integracji
  MJPEG IP Camera — ekran kiosku na żywo jako kamera w HA.
- **Dodatek Kioski 1.1.0:** przy każdym kiosku „aktualna” albo „↑ dostępna X” i przycisk „Aktualizuj do X”,
  „Aktualizuj wszystkie z GitHuba”; pasek, gdy w repozytorium jest nowsza wersja samego dodatku.
- **Aplikacja Kiosk 1.4:** „Aktualizuj aplikację automatycznie” (domyślnie włączone) — nowa wersja instaluje się
  sama przy codziennym sprawdzeniu (Android 12+ bez pytania, gdy system na to pozwala).
- Gotowe pakiety: `releases/kiosk-setup_1.0.14_amd64.deb`, `releases/kiosk-setup-light_1.0.14_amd64.deb`,
  `releases/kiosk-android-1.4.apk`.

## 1.0.13 (2026-10-18)
- **Szybki podgląd ekranu na żywo:** Kamery → „▶ Na żywo” pokazuje teraz strumień wideo ekranu kiosku (MJPEG z ffmpeg,
  ok. 10 klatek/s, obraz dopasowany do telefonu, ok. 20% jednego rdzenia tylko podczas oglądania) zamiast wolnego VNC.
  „Sterowanie” przełącza na VNC (z mocniejszą kompresją) do klikania i pisania. Podgląd dostępny też dla domowników.
- Gotowe pakiety: `releases/kiosk-setup_1.0.13_amd64.deb`, `releases/kiosk-setup-light_1.0.13_amd64.deb`.

## 1.0.12 (2026-10-18)
- **Ekran kiosku na żywo (VNC w panelu):** Kamery → „▶ Na żywo” — płynny podgląd ekranu kiosku w przeglądarce
  i w aplikacji, bez osobnego programu VNC. Domyślnie tylko podgląd; „Sterowanie” pozwala klikać i pisać na kiosku.
  noVNC 1.7.0 w panelu, połączenie WebSocket → x11vnc (127.0.0.1:5900) z jednorazowym biletem (tylko administrator),
  działa też przez HTTPS. „Wstecz” w telefonie zamyka podgląd.
- Gotowe pakiety: `releases/kiosk-setup_1.0.12_amd64.deb`, `releases/kiosk-setup-light_1.0.12_amd64.deb`.

## Aplikacja Kiosk 1.3 (2026-10-18)
- **Aktualizacja aplikacji z GitHuba:** aplikacja raz dziennie sprawdza `android.json` w repozytorium (i przyciskiem
  „Sprawdź aktualizację aplikacji” w jej ustawieniach), pobiera nowy APK, sprawdza SHA-256 i uruchamia systemową
  instalację. Gdy instalacja się nie uda — otwiera pobieranie w przeglądarce. Wersję 1.3 trzeba zainstalować raz ręcznie.

## 1.0.11 (2026-10-18)
- **Nowy układ panelu:** strona główna to **Pilot** — „Teraz gra”, głośność −/+ i stop, kafelki ulubionych stacji,
  widoki i ekran, „Powiedz”, jasność. Nowa zakładka **Kamery**: podgląd ekranu kiosku i kamery na żądanie.
- **Na telefonie:** trzy zakładki na dole (Pilot, Kamery, Ustawienia) zamiast dwóch przewijanych pasków u góry;
  **Ustawienia** to jedna lista sekcji (jak w Androidzie) z paskiem „‹ Ustawienia” w każdej pozycji; jedna warstwa ramek,
  krótszy nagłówek.
- **Aplikacja Kiosk 1.2** (`releases/kiosk-android-1.2.apk`): otwiera się na Pilocie (radio i głośność na górze);
  w ustawieniach aplikacji widok po otwarciu: Pilot, Kamery, Radio i muzyka, Ustawienia.
- Gotowe pakiety: `releases/kiosk-setup_1.0.11_amd64.deb`, `releases/kiosk-setup-light_1.0.11_amd64.deb`.

## 1.0.10 (2026-10-18)
- **Aplikacja Kiosk 1.1** (`releases/kiosk-android-1.1.apk`): otwiera się od razu na sterowaniu radiem; w ustawieniach
  aplikacji wybór widoku po otwarciu (Radio, Start, Głośność, Co wyświetla kiosk). Instaluje się na wersję 1.0.
- **Radio w panelu:** „Teraz gra” (stacja i utwór) i duże kafelki ulubionych stacji — stuknięcie gra, ponowne zatrzymuje;
  na telefonie lista rozwijana chowa się, gdy są kafelki.
- Gotowe pakiety: `releases/kiosk-setup_1.0.10_amd64.deb`, `releases/kiosk-setup-light_1.0.10_amd64.deb`.

## 1.0.9 (2026-10-18)
- **Aplikacja na Androida** (`releases/kiosk-android-1.0.apk`, kod w `kiosk-android/`): panel kiosku na pełnym
  ekranie, fizyczne przyciski głośności telefonu sterują głośnością kiosku, wyszukiwanie kiosków w sieci,
  zapamiętany token, HTTPS kiosku z potwierdzeniem odcisku certyfikatu, przycisk „wstecz” cofa zakładki.
- **Panel na telefonie:** pasek pilota na dole (głośność −/+, stop, ekran wł./wył.), większe pola dotyku,
  instalacja na ekranie głównym (manifest aplikacji, ikona, kolor paska), przyciski −/+ przy głośności.
- **Przyciski głośności w przeglądarce:** gdy przeglądarka je przekazuje (klawiatury, część przeglądarek),
  sterują głośnością kiosku; API `{"volume_step": 5}` w `POST /api/audio` i MQTT `volume/step`.
- Gotowe pakiety: `releases/kiosk-setup_1.0.9_amd64.deb`, `releases/kiosk-setup-light_1.0.9_amd64.deb`.

## 1.0.8 (2026-10-18)
- **Rozpoznawanie twarzy (lokalnie):** Automatyka → Rozpoznawanie twarzy. Kiosk wykrywa twarze na wybranych kamerach
  (YuNet) i rozpoznaje dodane osoby (SFace, OpenCV) — bez chmury. Osoby: zdjęcia albo zapis twarzy prosto z kamery.
  W HA: czujniki „Twarze kamera N”, „Osoba kamera N” i zdarzenie „Twarz” (rozpoznana / nieznana). Reakcje: powitanie
  głosem („Cześć, {imie}!”), alarm z kamerą i nagranie przy nieznanej osobie. Instalacja na żądanie
  (`sudo kiosk-faces install`, ok. 100 MB z internetu, ok. 300 MB na dysku); działa też w wersji light (bez powitania).
- **Szybsze aktualizacje:** `update-grub` i `update-initramfs` uruchamiają się tylko po zmianie linii startowej
  albo motywu startowego (logo); wymuszenie: `sudo kiosk-bootlogo initramfs --force`.
- Gotowe pakiety: `releases/kiosk-setup_1.0.8_amd64.deb`, `releases/kiosk-setup-light_1.0.8_amd64.deb`.

## 1.0.7 (2026-10-18)
- **Przełączanie edycji:** System → Aktualizacje → „Przełącz na wersję light” / „Przełącz na wersję pełną” —
  kiosk pobiera z GitHuba pakiet drugiej edycji, instaluje go (ustawienia zostają) i przestawia adres
  aktualizacji na `update.json` albo `update-light.json`. W terminalu: `sudo kiosk-update switch light|full`.
- **Aktualizacja przez panel WWW:** wgrywanie pakietu działa też przy przesyłaniu porcjami (chunked) i przyjmuje
  pakiet light; „Jaka wersja jest dostępna?” i „Aktualizuj z GitHuba” zapisują adres same (bez „Zapisz”);
  panel pokazuje błąd aktualizacji zamiast komunikatu o sukcesie i „Brak nowszej wersji”, gdy nic nie zainstalowano;
  przy nieudanej instalacji kiosk odświeża listy pakietów (`apt-get update`) i próbuje ponownie (nowe zależności).
- **Pasek informacyjny:** przewijany tekst nie zapętla się już po lewej stronie — krótki tekst wychodzi w całości
  za lewą krawędź i wjeżdża z prawej, długi płynie w dwóch kopiach z odstępem.
- Gotowe pakiety: `releases/kiosk-setup_1.0.7_amd64.deb`, `releases/kiosk-setup-light_1.0.7_amd64.deb`.

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
