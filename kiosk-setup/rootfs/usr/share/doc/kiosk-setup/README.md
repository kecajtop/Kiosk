# kiosk-setup

Konfiguruje Ubuntu Server jako dedykowany kiosk IoT: X server pokazujący
do wyboru stronę WWW (Chromium), obraz z kamer IP (RTSP, kilka w siatce)
albo kamerę USB (zawsze autostart), autologin, własny splash
screen (Plymouth), wyłączone MOTD, firewall ograniczający ruch wychodzący
wyłącznie do adresu kiosku i serwerów aktualizacji Ubuntu, watchdog IP,
zdalną konfigurację sieci/WiFi przez SSH, zdalny podgląd ekranu przez VNC
oraz ograniczenie zapisów logów na dysk/kartę SD.

## Wymagania

- Ubuntu Server (fizyczna konsola — nie przez SSH)
- GRUB jako bootloader
- Konto użytkownika, które ma być kioskiem, musi już istnieć
  (`sudo adduser nazwa_uzytkownika`), zanim zainstalujesz pakiet

## Instalacja

```bash
sudo apt update
sudo apt install ./kiosk-setup_1.12_amd64.deb
```

Podczas instalacji pakiet zapyta (przez debconf) o:

1. **Nazwę użytkownika do autologinu** — musi istnieć w systemie
2. **Tryb kiosku** — `web` (strona WWW), `rtsp` (kamery IP) lub `usb`
   (kamera USB), a potem zależnie od trybu: adres strony, adresy kamer
   RTSP (po przecinku) albo urządzenie kamery (`/dev/video0`)
3. **Ścieżkę do pliku logo** (opcjonalnie) — własny PNG; zostaw puste,
   aby użyć wbudowanego logo kecaj (patrz „Logo”)
4. **Czy ograniczyć firewall** — tak/nie
5. **Po ilu minutach od startu wyłączyć serwer** — `0` wyłącza tę funkcję
6. **Lista adresów IP, do których ograniczyć SSH/VNC** (opcjonalnie) —
   np. `203.0.113.5,10.8.0.0/24`; puste = cała sieć lokalna

Jeśli `apt`/`dpkg` nie poradzi sobie z zależnościami automatycznie:

```bash
sudo apt --fix-broken install
```

## Po instalacji

```bash
sudo reboot
```

Po restarcie system powinien: pokazać splash z logo → automatycznie
zalogować skonfigurowanego użytkownika na tty1 → uruchomić X →
otworzyć Chromium w trybie kiosk pod wskazanym adresem.

## Aktualizacja

Przy instalacji nowej wersji na już skonfigurowanym kiosku instalator zadaje
jedno pytanie: **„Uruchomić kreator konfiguracji kiosku?”**

- **Nie** (domyślnie) — wszystkie obecne ustawienia zostają: tryb ekranu i pulpit,
  kamery, adres strony, widoki, zegar, MQTT, firewall, logo, wyłączanie ekranu
  i komputera. Podmieniane są tylko programy kiosku.
- **Tak** — pytania instalatora jeszcze raz; podpowiedziami są obecne ustawienia
  (także te zmienione w panelu WWW i w `sudo kiosk-mode`).

Instalacja bez pytań (np. przez SSH skryptem) też zachowuje ustawienia:
`sudo DEBIAN_FRONTEND=noninteractive apt install ./kiosk-setup_*.deb`.

## Zmiana konfiguracji

Aby ponownie zadać pytania instalacyjne i zastosować nowe ustawienia:

```bash
sudo dpkg-reconfigure kiosk-setup
```

## Tryby: strona WWW / kamery RTSP / kamera USB

Przełączanie przez SSH, bez reinstalacji:

```bash
sudo kiosk-mode                       # menu
sudo kiosk-mode status                # aktualny tryb (hasła kamer ukryte)
sudo kiosk-mode web  http://192.168.0.1:8123/energy/electricity
sudo kiosk-mode rtsp rtsp://admin:haslo@192.168.0.203:554/ rtsp://admin:haslo@192.168.0.204:554/
sudo kiosk-mode usb  /dev/video0
sudo kiosk-mode mix  http://192.168.0.1:8123/ rtsp://admin:haslo@192.168.0.203:554/
sudo kiosk-mode split 60              # mix: strona zajmuje 60% szerokości
sudo kiosk-mode restart               # tylko restart ekranu
sudo kiosk-mode api-token             # token panelu WWW / API
```

Po zmianie ekran kiosku uruchamia się ponownie sam (X startuje w pętli
z `~/.bash_profile`), a firewall dostaje adresy nowych kamer.

- **Wiele kamer** — siatka liczona automatycznie z rozdzielczości ekranu:
  1 kamera na pełny ekran, 2 → 2×1, 3–4 → 2×2, 5–6 → 3×2, 7–9 → 3×3.
  Każda kamera ma własną pętlę ponownego łączenia, więc awaria jednej
  nie wyłącza pozostałych.
- **Strona + kamery (`mix`)** — strona WWW po lewej (domyślnie 50%
  szerokości, zmiana: `sudo kiosk-mode split 60`), kamery w siatce po
  prawej; przy 1–3 kamerach w wąskim pasie układają się jedna pod drugą.
- **Niskie opóźnienie** — mpv z RTSP po TCP, bez bufora i bez dźwięku,
  z dekodowaniem sprzętowym (`--hwdec=auto`). Na grafice Intela przyda
  się `sudo apt install intel-media-va-driver`. Przy wielu kamerach
  używaj lżejszego strumienia kamery (substream), np. Hikvision
  `/Streaming/Channels/102`, Dahua `/cam/realmonitor?channel=1&subtype=1`.
- Konfiguracja: `/etc/kiosk-setup/kiosk.conf` (czytelna tylko dla roota
  i użytkownika kiosku, bo zawiera hasła kamer). Log sesji:
  `~/.kiosk-session.log` użytkownika kiosku.
- `startx` nie da się uruchomić przez SSH (brak dostępu do konsoli) —
  do zmian używaj `kiosk-mode`.

## Menu w terminalu (`sudo kiosk-mode`)

Bez argumentów `sudo kiosk-mode` otwiera menu:

- **Co wyświetla** — strona WWW, kamery RTSP, mix, kamera USB
- **Ekran** — pulpit + kiosk na drugim monitorze albo cały komputer jako kiosk
  (pyta o restart)
- **Pulpit** (tryb z pulpitem) — który pulpit startuje na monitorze głównym:
  Cinnamon, XFCE, KDE Plasma… (z zainstalowanych) albo „Zainstaluj inny pulpit”
  (LightDM + Cinnamon / XFCE / KDE z repozytorium Ubuntu)
- **Logowanie do pulpitu** (tryb z pulpitem) — automatyczne (kiosk startuje sam)
  albo ekran logowania z hasłem
- **Home Assistant (MQTT)** — wyszukanie brokera w sieci, login, połączenie
- **Blokada internetu (firewall)** — włącz / wyłącz
- **Logo przy starcie** — logo kecaj, bez logo na stałe (widać komunikaty systemu)
  albo bez logo tylko przy następnym uruchomieniu (potem wraca samo)
- **Stan kiosku**, **Odśwież ekran kiosku**, **Adres i hasło panelu WWW**

To samo z wiersza poleceń: `sudo kiosk-mode session desktop|kiosk`,
`sudo kiosk-mode autologin yes|no`, `sudo kiosk-mode desktop cinnamon|xfce|auto`
(bez nazwy: lista zainstalowanych), `sudo kiosk-mode firewall on|off|status`, `sudo kiosk-mode bootlogo on|off|once`.

## Pulpit + kiosk na drugim monitorze

Jeśli komputer ma pulpit (np. XFCE z LightDM), instalator pyta „Jak ma działać
ekran?”:

- **desktop** — pulpit zostaje na monitorze głównym (z automatycznym
  logowaniem użytkownika kiosku), a kiosk (kamery / strona / zegar / dymek)
  zajmuje **drugie wyjście** (VGA, DisplayPort, HDMI). Kiosk startuje razem z
  pulpitem (autostart), sam ustawia drugi monitor obok głównego i dopasowuje
  się po podłączeniu/odłączeniu monitora; bez drugiego monitora czeka.
- **kiosk** — cały komputer jako kiosk, bez pulpitu (jak w poprzednich wersjach).

Zmiana później: `sudo kiosk-mode session desktop` albo `sudo kiosk-mode session kiosk`,
potem `sudo reboot`. Który monitor zajmuje kiosk, jego rozdzielczość i obrót:
panel WWW → Monitory. „Wyłącz ekran” (panel, MQTT, HA) wyłącza tylko monitor
kiosku. W trybie z pulpitem automatyczne wygaszanie po bezczynności ustawiasz
w XFCE (Ustawienia → Menedżer zasilania; wyłącz tam też blokadę ekranu, żeby
nie zasłaniała kiosku). Kiosk ma własny profil Chromium — Twoja przeglądarka
na pulpicie jest od niego niezależna (do Home Assistant w kiosku zaloguj się raz).

## Panel WWW

Na kiosku działa panel `http://ADRES_KIOSKU:8088/` (usługa `kiosk-api`).
Przeglądarka zapyta o login: użytkownik dowolny, hasło = token z
`sudo kiosk-mode api-token`. Token jest generowany przy instalacji
(`/etc/kiosk-setup/api-token`, czytelny tylko dla roota) i nie zmienia się
przy aktualizacjach. Nowy token: usuń ten plik i zrób `dpkg-reconfigure kiosk-setup`.

Na górze widać nazwę kiosku i krótki stan. Z lewej (na telefonie u góry) jest
menu z siedmioma sekcjami, a w każdej sekcji kilka zakładek:

| Sekcja | Zakładki |
|---|---|
| **Start** | widoki jednym kliknięciem, szybkie przyciski (ekran, noc, alarm, radio, dźwięk), głośność, jasność, „Powiedz” |
| **Ekran** | Co wyświetla kiosk · Widoki (z rotacją) · Monitory · Jasność i wyłączanie |
| **Komunikaty** | Dymek · Powiedz na głos (z mówiącym zegarem) · Alarm na ekranie · Pasek informacyjny |
| **Dźwięk** | Głośność i głos · Radio i muzyka · Wiadomość i interkom · Asystent głosowy |
| **Automatyka** | Harmonogram · Obecność i noc · Zdjęcia · Kalendarz · Ruch na kamerach · Pogoda |
| **Połączenia** | MQTT i Home Assistant · Frigate/go2rtc · Kioski w sieci · Jak używać (MQTT, HA, API) |
| **System** | Nazwa kiosku · Konta i dostęp · Aktualizacje i kopia · Dysk tylko do odczytu · Powiadomienia i ochrona · Diagnostyka |

Zakładkę można otworzyć adresem, np. `http://ADRES_KIOSKU:8088/#/mqtt`; strzałki
←/→ przełączają zakładki w sekcji. Domownik (konto „domownik”) widzi tylko Start,
widoki, komunikaty i dźwięk.

## Nazwa kiosku (panel → System → Nazwa kiosku)

Każdy kiosk może mieć własną nazwę, np. **Salon** albo **Kuchnia** — zamiast „kecaj”.
Jedna zmiana ustawia:

- nazwę w Home Assistant: urządzenie „Kiosk Salon”, a także odtwarzacz DLNA,
  asystenta głosowego i tytuły powiadomień,
- nazwę komputera (hostname), np. `salon`,
- tematy MQTT, np. `kiosk/salon/…` (stare zachowane wiadomości są czyszczone).

Hostname i tematy podpowiadają się same z nazwy (bez polskich znaków), można je
zmienić. Domyślnie encje w HA **zachowują identyfikatory** (np.
`notify.kecaj_kecaj_say`), więc automatyzacje działają dalej — zmienia się tylko
wyświetlana nazwa. Opcja **Nowe identyfikatory encji** usuwa stare encje i tworzy
nowe z nazwy (np. `notify.kiosk_salon_say`) — wtedy popraw automatyzacje. Pamiętaj
o zmianie tematów MQTT w automatyzacjach, które publikują bezpośrednio na tematy.

W terminalu: `sudo kiosk-mode name Salon [hostname] [prefiks/mqtt]`.

Panel działa po zwykłym HTTP, więc nie wystawiaj go do internetu — z
zewnątrz tylko przez VPN. Port 8088 firewall ogranicza tak samo jak SSH i VNC.

## Widoki (presety)

**Ekran → Widoki → + Nowy widok** — nazwa, rodzaj (strona / kamery / strona + kamery /
kamera USB), adres strony, kamery do zaznaczenia (z listy wszystkich znanych kamer
albo nowe adresy), szerokość strony i zegar. **Zapisz** nie zmienia ekranu, **Zapisz i
pokaż** od razu go pokazuje. **Edytuj** przy widoku zmienia też nazwę — rotacja,
harmonogram i drugi monitor same przechodzą na nową nazwę. „Zapisz obecny ekran jako
widok” zapisuje to, co jest teraz na ekranie. Widoki przełączasz na stronie Start,
w Home Assistant, w harmonogramie i z dodatku „Kioski”.

Przełączanie stron i widoków nie pokazuje już logo: do czasu pojawienia się nowej
zawartości na ekranie zostaje ostatni kadr (logo tylko przy starcie kiosku).

Widok to zapisany zestaw: tryb, strona, kamery, proporcje. Przykłady:
„salon” = panel HA + 2 kamery w mix 60%, „noc” = 4 kamery, „wejście” =
kamera przy drzwiach. Zapisz w panelu („Zapisz to, co jest teraz na
ekranie”) albo przez API, a przełączaj jednym komunikatem (`view/set`) —
także z automatyzacji Home Assistant. Przełączanie trybu, widoku i
zawartości podmienia tylko obraz (1–2 s), bez restartu X i bez czarnego
ekranu. Pełny restart X: `sudo kiosk-mode restart`.

## Monitory (kilka wyjść: DisplayPort, VGA, HDMI)

Panel → zakładka **Monitory** pokazuje wykryte wyjścia i pozwala ustawić:

- **monitor główny** (kiosk): wyjście, rozdzielczość, obrót (poziomo /
  pionowo / do góry nogami);
- **pozostałe monitory**: wyłączone, lustro (to samo co główny) albo
  **osobna treść** — drugi monitor pokazuje wybrany zapisany widok, np. na
  DisplayPorcie kamery, a na VGA panel Home Assistant.

Widok drugiego ekranu przełączysz też przez MQTT (`second_view/set` →
nazwa widoku albo `brak`), API (`POST /api/displays`) i z Home Assistant
(lista „Widok na drugim ekranie”). Zegar, siatka kamer i dymek liczą się
względem monitora głównego; drugi ekran ma własny zegar z ustawień widoku.
Odłączony monitor nie psuje obrazu — kiosk wraca wtedy do pierwszego
dostępnego. Ustawienia: `/etc/kiosk-setup/displays.conf`; wykryte obszary:
`/tmp/kiosk-areas`. VGA nie przenosi dźwięku i przy wysokich
rozdzielczościach daje gorszy obraz — do kamer lepszy DisplayPort/HDMI.

## Zegar

**Wygląd zegara** (panel → Ekran → Co wyświetla kiosk) — kafelki z podglądem:
klasyczny, klapkowy (flip), analogowy, woltomierze, 7-segmentowy, matryca LED oraz
animowane: wąż, platformówka (robot uderza w klocek z cyfrą, gdy zmienia się minuta),
ekran komputera 8-bit, niebieski ekran, **oczy z zegarem** (oczy rozglądają się,
mrugają i zerkają na godzinę przy zmianie minuty) i **same oczy**. Do tego wyświetlacze znakowe **LCD 1602** (duże HH:MM, dzień
tygodnia i sekundy) i **LCD 2004** (duże HH:MM:SS, data i temperatura) z wyborem
podświetlenia: zielone, niebieskie albo bursztynowe. Wygląd dotyczy zegara w rogu, kafelka w
siatce kamer i nocnego zegara; zmiana działa po kilku sekundach, bez przeładowania
(`/etc/kiosk-setup/clock.json`).

Godzina (HH:MM) i data po polsku, np. „wtorek, 13 października”:

- **W rogu** (`corner`) — nakładka nad kamerami albo stroną; róg `tl`, `tr`,
  `bl`, `br` i wielkość `s`, `m`, `l`.
- **Kafelek** (`tile`) — zegar zajmuje jedno pole siatki kamer (np. 3 kamery +
  zegar = 2×2; w trybie mix — w części z kamerami). W trybach `web` i `usb`
  kafelek zamienia się w zegar w rogu. Tryb kamer bez kamer + kafelek =
  zegar na cały ekran.

Ustawienia: panel (Ekran → Zegar), `sudo kiosk-mode clock tile` /
`sudo kiosk-mode clock corner br l` / `sudo kiosk-mode clock off`, MQTT
`clock/set` (`off`/`corner`/`tile` lub `{"clock":"corner","position":"tr","size":"m"}`)
i `clock_position/set`, API `POST /api/mode` z polami `clock`,
`clock_position`, `clock_size`, w Home Assistant — listy „Zegar” i „Pozycja
zegara”. Zegar zapisuje się też w widokach. Strefa czasowa systemu:
`sudo timedatectl set-timezone Europe/Warsaw`.

### Mówiący zegar

Na komendę kiosk mówi aktualną godzinę wybranym głosem, słownie po polsku
(„Jest godzina dwudziesta druga i siedem minut.”, „Jest piętnaście minut po północy.”), opcjonalnie z datą („Dziś
jest wtorek, trzynasty października.”) i z dymkiem pokazującym godzinę. Głos
`jarvis-en` mówi po angielsku („The time is 10:07 PM.”).

- MQTT `time/set`: pusta treść = sama godzina, `date` = z datą, albo JSON
  `{"date":true,"bubble":true,"voice":"jarvis","seconds":8}`.
- API `POST /api/time` z tymi samymi polami (wszystkie opcjonalne).
- Home Assistant: przyciski „Powiedz godzinę” i „Powiedz godzinę i datę”.
- Panel: Dźwięk → Mówiący zegar.

Przykład — co godzinę od 7 do 22 (automatyzacja HA):

```yaml
automation:
  - alias: Kiosk mówi godzinę
    trigger:
      - platform: time_pattern
        minutes: 0
    condition:
      - condition: time
        after: "07:00:00"
        before: "22:01:00"
    action:
      - service: mqtt.publish
        data: { topic: kecaj/kiosk/time/set, payload: "{}" }
```

## Pogoda

Przy zegarze (w rogu i w kafelku) pojawia się linia z ikoną, temperaturą i
opisem, np. „☂ 9°C deszcz”. Odświeżanie co 10 minut. Ustawienia: panel →
Ekran → Pogoda przy zegarze, albo `POST /api/weather`.

- **Home Assistant (polecane)** — `{"source":"ha","ha_url":"http://192.168.0.1:8123",
  "entity":"weather.forecast_dom","ha_token":"…"}`. Encję znajdziesz w HA:
  Ustawienia → Urządzenia i usługi → Encje, filtr „weather.” (integracja Met.no
  jest w HA domyślnie). Token: profil użytkownika → Bezpieczeństwo → Tokeny
  długoterminowe → Utwórz token (najlepiej dla osobnego użytkownika „kiosk”).
- **Open-Meteo** — `{"source":"open-meteo","lat":52.23,"lon":21.01}`; bez klucza,
  potrzebny internet (firewall kiosku dopuszcza `api.open-meteo.com`).
- **Na głos**: „Na zewnątrz dziewięć stopni, deszcz.” — MQTT `weather/set`
  (`{}` lub `{"bubble":true,"voice":"lektorka"}`), `POST /api/weather/say`,
  przycisk HA „Powiedz pogodę”, panel → Dźwięk; z mówiącym zegarem:
  `time/set` z `{"weather":true}`.

Token i ustawienia: `/etc/kiosk-setup/weather.json` (tylko root);
ostatni odczyt: `/run/kiosk-weather.json`.

## Dymek na ekranie

Komunikat na środku ekranu, zawsze nad kamerami i stroną: tytuł, treść,
rodzaj (`info`, `ok`, `warning`, `alert` — inny kolor i ikona), czas
wyświetlania (0 = do zamknięcia). Dotknięcie zamyka dymek. Domyślnie
wybudza wygaszony ekran; z `"say": true` treść jest też czytana na głos.

## Dźwięk i mowa

- **Odtwarzacz MPD** (usługa `kiosk-mpd`, port 6600). W Home Assistant:
  *Ustawienia → Urządzenia i usługi → Dodaj integrację → Music Player
  Daemon (MPD)*, host = adres kiosku, port 6600, hasło = token panelu.
  Powstaje `media_player`, więc działa `tts.speak` z dowolnym silnikiem HA
  (Piper, Google Translate…), odtwarzanie muzyki, radia i dzwonków oraz
  głośność.
- **Lokalna mowa na kiosku** (Piper, bez internetu po pobraniu głosów):
  `say/set` w MQTT, `POST /api/say`, pole „Powiedz” w panelu, dymek z
  `"say": true`. Style głosu (wybór w panelu: Dźwięk → Głos, MQTT
  `voice/set`, albo pole `voice` w komendzie):

  | Styl | Głos Piper | Charakter |
  |---|---|---|
  | `jarvis` (domyślny) | `pl_PL-darkman-medium` | asystent w stylu JARVIS: męski, spokojny, lekko obniżony, cyfrowy pogłos |
  | `jarvis-en` | `en_GB-alan-medium` | to samo po angielsku, brytyjski akcent |
  | `lektorka` | `pl_PL-gosia-medium` | ciepły, spokojny kobiecy głos, wolne tempo i pauzy jak w filmie przyrodniczym |
  | `kobieta`, `mezczyzna` | gosia / darkman | naturalne, bez efektów |
  | `robot` | darkman | wyraźnie robotyczny |
  | `espeak` | — | awaryjny syntezator, zawsze dostępny |

  Style to brzmienie „w klimacie” — nie są kopią głosu żadnej konkretnej
  osoby. Głosy pobiera instalator do `/var/lib/kiosk-voices` (ok. 60 MB
  każdy; firewall na ten czas przepuszcza HTTPS). Bez nich czyta espeak.
  `sudo kiosk-voice list`, `sudo kiosk-voice install` (ponowienie),
  `sudo kiosk-voice install pl_PL-mc_speech-medium` (inny głos z katalogu
  rhasspy/piper-voices). Efekty dźwiękowe nakłada ffmpeg.
- **Wyjście audio**: ALSA, urządzenie domyślne. Inne wyjście (np. HDMI):
  `aplay -l`, potem w `/etc/kiosk-setup/mpd.conf` dopisz w `audio_output`
  `device "hw:0,3"` i `sudo systemctl restart kiosk-mpd` (reinstalacja
  nadpisze ten plik).
- Komunikat głosowy przerywa aktualnie grający dźwięk.

### Gong i przyciszanie muzyki

Przed każdym komunikatem głosowym (Powiedz, notify z HA, MQTT `say/set`,
mówiący zegar, pogoda, dymek z czytaniem) kiosk gra **gong jak na lotnisku**
(trzy rosnące dźwięki dzwonka), a muzyka/radio z kiosku i odtwarzacz DLNA
grają w tym czasie **ciszej** — po komunikacie głośność płynnie wraca.
Komunikaty nie przerywają już muzyki i odtwarzają się po kolei.

Ustawienia: panel → **Dźwięk** → „Gong przed komunikatem” i suwak „Muzyka
i inne dźwięki podczas komunikatu” (domyślnie 40%; 100% = bez przyciszania).
Bez gongu dla jednego komunikatu: `{"text":"…","chime":false}` na `say/set`.

## Teraz gra (karta na ekranie)

Gdy kiosk coś odtwarza, na dole ekranu jest karta „Teraz gra”: radio z ulubionych
(nazwa stacji i tytuł utworu nadawany przez stację), muzyka wysłana z Home Assistant
na odtwarzacz DLNA kiosku (wykonawca, tytuł i okładka) albo plik/strumień z adresu
wpisanego w panelu. Komunikaty głosowe nie są pokazywane. Położenie (dół na środku,
rogi, góra) albo wyłączenie: panel → Ekran → Co wyświetla kiosk. To samo widać w
nagłówku panelu („Gra”) i w dodatku „Kioski”.

## Ikony połączeń i postęp aktualizacji na ekranie

W rogu ekranu kiosku małe ikony: **LAN**, **Wi‑Fi** (siła sygnału), **internet**,
**Home Assistant** i **MQTT** — zielona działa, czerwona przekreślona = brak połączenia,
pomarańczowe Wi‑Fi = słaby sygnał. Pokazują się tylko połączenia, które są używane.
Róg, wyłączenie albo „tylko gdy coś nie działa”: panel → Ekran → Co wyświetla kiosk.
Ten sam stan jest w nagłówku panelu („Połączenia”).

Podczas aktualizacji na środku ekranu jest karta z postępem: pobieranie (MB, %),
kolejne kroki instalacji i wynik („Kiosk zaktualizowany” albo błąd). Nocne
sprawdzanie aktualizacji pokazuje kartę dopiero, gdy jest nowsza wersja.

## Ekran i zasilanie

**Sposób przyciemniania** (Ekran → Jasność i wyłączanie): automatycznie, DDC/CI albo
programowo. Monitory na VGA często przyjmują polecenie DDC/CI, ale jasności nie
zmieniają — kiosk teraz to sprawdza i sam przechodzi na przyciemnianie programowe;
„Programowo” działa zawsze (przyciemnia obraz, podświetlenie świeci dalej).
**Odwrotna jasność** — dla monitorów, w których po naprawie/wymianie podświetlenia (np.
na LED) sterowanie działa na odwrót: kiosk wysyła do monitora wartość odwrotną, więc
suwak, tryb nocny i jasność z Home Assistant działają normalnie.

- **Wygaszanie ekranu** po N minutach bez dotyku, myszy i klawiatury
  (`screen_off_minutes`, 0 = nigdy); dotknięcie budzi. Odtwarzanie kamer
  nie blokuje wygaszania.
- **Włącz / wyłącz monitor** na żądanie (np. czujnik ruchu w HA):
  `screen/set` `ON`/`OFF`, `POST /api/screen`, encja „Ekran” w HA.
- **Wyłączenie komputera N minut po każdym starcie** (`shutdown_after_minutes`,
  0 = nigdy; usługa `kiosk-power`).
- **Jednorazowo**: wyłącz za N minut, wyłącz teraz, anuluj
  (`shutdown/set`, `POST /api/shutdown`).
- Z SSH: `sudo kiosk-mode screen-timeout 15`, `sudo kiosk-mode power-off-after 600`,
  `sudo kiosk-power screen off`, `sudo kiosk-power shutdown 30`, `sudo kiosk-power cancel`.

## Automatyka (panel → Automatyka)

### Alarm: kamera na ekran
Na chwilę pokazuje kamerę (albo zapisany widok / stronę) na cały ekran, z gongiem
i dymkiem, potem wraca poprzedni obraz. Budzi wyłączony ekran.

```yaml
# Home Assistant, np. po naciśnięciu dzwonka:
action: mqtt.publish
data:
  topic: kecaj/kiosk/alert/set
  payload: '{"camera": 1, "seconds": 30, "title": "Dzwonek", "text": "Ktoś przy furtce", "say": true}'
```
`camera`: numer kamery z listy (1, 2, …) albo adres `rtsp://`; zamiast tego `view`
(nazwa widoku) albo `url` (strona). Zakończenie wcześniej: `alert/set` = `OFF`
albo przycisk „Zakończ alarm” w HA. API: `POST /api/alert`, `POST /api/alert/stop`.

### Harmonogram
Godzina + dni tygodnia + akcja: pokaż widok, wyłącz/włącz ekran, powiedz tekst,
odśwież ekran. Np. 6:30 widok „rano”, 9:00 „kamery”, 23:00 wyłącz ekran, 6:00 włącz.

### Obecność
Ekran gaśnie po N minutach bez ruchu i włącza się, gdy ktoś wejdzie. Źródło:
encja HA (czujnik ruchu/obecności — kiosk odpytuje HA co 3 s; adres i token HA
jak dla pogody) albo MQTT `presence/set` = `ON`/`OFF` z automatyzacji HA.
Brak sygnału = nikogo nie ma, więc włączaj tylko, gdy masz czujnik.

### Pasek informacyjny
Przewijany tekst na dole ekranu (treść kiosku kończy się nad nim): własne teksty,
stany encji HA (np. `sensor.temperatura_salon`), pogoda. Chwilowy komunikat
(wyróżniony ⚠, domyślnie 30 min): encja HA „Komunikat na pasku” albo MQTT
`ticker/set` (`{"text":"…","minutes":10}`).

## Podgląd ekranu
Panel → Debug → „Zrób zrzut ekranu”; w HA encja kamery **„Podgląd ekranu”**
(zrzut przez MQTT co 60 s; panel → MQTT → pole „screenshot”, 0 = wyłączone).
W trybie pulpit + kiosk zrzut obejmuje tylko monitor kiosku — pulpit zostaje prywatny.

## Wiadomość głosowa
Panel → Dźwięk → „Nagraj / wybierz nagranie…”: na telefonie otwiera dyktafon,
nagranie gra na kiosku po gongu (muzyka ściszona). Z HA: MQTT `message/set`
= adres pliku audio (`{"url":"http://…/wiadomosc.mp3","chime":true}`).
Przycisk nagrywania bezpośrednio w przeglądarce pojawia się tylko przy
połączeniu HTTPS (wymóg przeglądarek); przez HTTP służy wybór pliku/dyktafon.

## Kopia ustawień i aktualizacje (panel → System)
- **Pobierz kopię** — wszystkie ustawienia w jednym `.tar.gz` (zawiera hasła
  kamer i MQTT). **Przywróć z pliku** — także na innym kiosku (użytkownik kiosku
  zostaje miejscowy), panel restartuje się sam.
- **Wgraj nową wersję (.deb)** — aktualizacja z przeglądarki, ustawienia zostają,
  postęp i dziennik na tej samej stronie.
- **Automatycznie w nocy** — podaj adres aktualizacji; codziennie ok. 3:30 kiosk
  sprawdza go i instaluje tylko nowszą wersję. Adres może być:
  - **GitHub** (przycisk „Użyj GitHub”): `https://raw.githubusercontent.com/kecajtop/Kiosk/main/update.json`
    — plik z wersją, adresem pakietu i sumą SHA-256; pakiet pobierany jest tylko,
    gdy wersja jest nowsza, a po pobraniu sprawdzana jest jego suma,
  - **API wydań GitHub**: `https://api.github.com/repos/kecajtop/Kiosk/releases/latest`
    (plik `kiosk-setup_*_amd64.deb` dołączony do wydania),
  - **wprost plik .deb**, np. wgrany do folderu `www` w Home Assistant:
    `http://192.168.0.1:8123/local/kiosk-setup.deb`.

  Przy adresie z GitHuba zapora kiosku sama przepuszcza serwery GitHuba.
  „Jaka wersja jest dostępna?” tylko sprawdza, nic nie instaluje.
  Ręcznie: `sudo kiosk-update latest` (sprawdź), `sudo kiosk-update check`
  (sprawdź i zainstaluj), plik: `sudo kiosk-update file plik.deb`,
  dziennik: `/var/log/kiosk-update.log`.

## Więcej funkcji

### Rotacja widoków, tryb nocny, zdjęcia
- **Rotacja** (Automatyka): zaznaczone widoki po kolei co N s; w HA przełącznik
  „Rotacja widoków” (MQTT `rotation/set` ON/OFF). Wstrzymana podczas alarmu,
  nocy i wygaszacza.
- **Tryb nocny** (Automatyka): w godzinach od–do przyciemniony ekran i (opcja)
  sam duży zegar. W HA przełącznik „Tryb nocny” — wymusza noc/dzień
  (`night/set` ON/OFF, `AUTO` = wg godzin).
- **Zdjęcia** (Automatyka): wgrywasz zdjęcia w panelu; pokaz na żądanie albo
  zamiast wyłączania ekranu, gdy nikogo nie ma (Obecność → „Pokaż zdjęcia”).
  MQTT `photos/set` ON/OFF. Zdjęcia: `/var/lib/kiosk-photos`.

### Kalendarz
Encje kalendarzy HA (`calendar.rodzina`…): karta „Plan dnia” w rogu ekranu
i wpisy na pasku informacyjnym; odświeżane co 5 min. Adres i token HA jak dla pogody.

### Ruch na kamerach, nagrania, Frigate/go2rtc
- Wykrywanie ruchu porównuje kolejne klatki kluczowe (co 1–4 s, mało CPU).
  Czułość 1–10 (zacznij od 6–7). Ruch → czujnik „Ruch kamera N” w HA, opcjonalnie
  alarm z tą kamerą i nagranie 20 s.
- Nagrania (`/var/lib/kiosk-clips`, do 200 plików / 3 GB): lista, odtwarzanie
  i pobieranie w panelu (Automatyka). Kamery H.265 nagrywają się, ale nie
  każda przeglądarka je odtworzy — pobierz plik.
- „Kamery z Frigate / go2rtc”: podaj adres serwera, kiosk pokaże strumienie
  `rtsp://serwer:8554/nazwa` do dodania jednym kliknięciem.

### Radio
Dźwięk → Radio internetowe: wyszukiwarka stacji (radio-browser.info), ulubione,
graj/stop. W HA lista „Radio” (`radio/set` nazwa albo `OFF`). Budzik:
harmonogram → „Radio (budzik)” — głośność narasta przez minutę.

### Interkom i asystent głosowy
- **Interkom:** z telefonu „Nagraj” (wiadomość gra na kiosku), „Posłuchaj kiosku
  (10 s)” — nagranie z mikrofonu kiosku. Potrzebny mikrofon w kiosku.
- **Asystent głosowy (Assist):** Dźwięk → „Zainstaluj” (pobiera ok. 50 MB z PyPI)
  albo `sudo kiosk-satellite install`. Kiosk staje się satelitą Assist;
  HA wykryje go jako „Wyoming Protocol”. W HA potrzebne: openWakeWord
  (słowo np. „Hey Jarvis”), Whisper lub HA Cloud, Piper.

### Jasność
Zasilanie → suwak „Jasność ekranu”; w HA liczba „Jasność ekranu”
(`brightness/set`). Monitor z DDC/CI (większość monitorów przez DisplayPort/HDMI,
też VGA) — zmienia się podświetlenie; bez DDC/CI — programowo (xrandr).

### Powiadomienia i ochrona
Zasilanie → „Powiadomienia na telefon”: usługa HA, np. `notify.mobile_app_telefon`.
Po 3 minutach problemu (ekran, kamery, dysk, pamięć, temperatura, MQTT)
powiadomienie, po naprawie — drugie. Opcjonalne wyłączenie komputera
powyżej podanej temperatury. W HA czujniki: temperatura procesora,
obciążenie, wolna pamięć, wolne miejsce, pobór mocy procesora (Intel).

### HTTPS, konta, kilka kiosków (System)
- Panel także przez **HTTPS**: `https://192.168.0.214:8443` (certyfikat kiosku —
  przeglądarka raz ostrzeże). Przez HTTPS działa nagrywanie w przeglądarce.
  Własny certyfikat: `/etc/kiosk-setup/tls/cert.pem` i `key.pem`.
- **Konta:** administrator albo domownik (widoki, dymek, dźwięk i radio, ekran).
  Token panelu zawsze działa jako administrator.
- **Kioski w sieci:** „Szukaj w sieci”, dodanie (adres + token tamtego kiosku),
  komenda na wszystkie naraz, kopiowanie ustawień na inny kiosk.

## Konsola debug

Panel WWW → zakładka **Debug**:

- **Diagnostyka** — jednym kliknięciem: usługi (panel, MPD, DLNA, VNC, LightDM),
  ekran (serwer X, sesja kiosku, odtwarzacze kamer, przeglądarka, monitor),
  sieć (IP, brama, internet, strona kiosku), każda kamera (czy port RTSP
  odpowiada), połączenie MQTT z Home Assistant, obciążenie, pamięć, dysk,
  temperatura, czas i wersja pakietu.
- **Dziennik** — panel/API, ekran kiosku (mpv, Chromium), ruch MQTT
  (← przychodzące, → wysłane), MPD, DLNA, błędy serwera X, LightDM, ostrzeżenia
  systemu; tryb „na żywo” i filtr.
- **Konsola komend** — te same komendy co MQTT (np. `bubble/set`,
  `say/set`, `view/set`), wykonane od razu; bez dostępu do powłoki.
- **Pobierz pełny raport (.txt)** — diagnostyka i wszystkie dzienniki w jednym
  pliku. Hasła kamer, token panelu, hasło MQTT i token HA są ukryte.

W terminalu: `sudo kiosk-mode` → **Diagnostyka i dzienniki** albo `sudo kiosk-mode debug`.

## Automatyczne wykrycie w Home Assistant

Kiosk sam pojawia się w Home Assistant jako urządzenie **„kecaj kiosk”** z
encjami (tryb, widok, ekran, dymek, mowa, głośność, przyciski, czujniki) —
przez MQTT discovery, bez pisania YAML. Potrzebne raz:

1. W HA: **Ustawienia → Dodatki → Mosquitto broker** (zainstaluj, uruchom) i
   integracja **MQTT** (HA zaproponuje ją sam po uruchomieniu dodatku).
2. W HA: **Ustawienia → Osoby → Użytkownicy** → dodaj użytkownika, np. `kiosk`
   (Mosquitto przyjmuje loginy użytkowników HA).
3. Na kiosku: panel WWW → **MQTT → „Wykryj broker w sieci”** → „Użyj” → wpisz
   użytkownika i hasło → Zapisz. Albo w terminalu `sudo kiosk-mode` →
   **Home Assistant (MQTT)** (sam znajdzie broker), albo `sudo kiosk-mode mqtt-detect`.

Po chwili kiosk jest w **Ustawienia → Urządzenia i usługi → MQTT**. Po
restarcie Home Assistant kiosk sam ogłasza encje ponownie (temat
`homeassistant/status`).

**Głośnik kiosku jako `media_player`** — bez MQTT i bez konfiguracji: kiosk
ogłasza się w sieci jako odtwarzacz **DLNA/UPnP** („kecaj kiosk”, usługa
`kiosk-dlna`). HA pokaże go w **Ustawienia → Urządzenia i usługi → Wykryto** —
kliknij **Skonfiguruj**. Działa `tts.speak`, muzyka, radio, głośność. Nazwa
i wyjście audio: `/etc/kiosk-setup/dlna.env`. Alternatywa: integracja
Music Player Daemon (port 6600, hasło = token panelu).

## MQTT

Włącz w panelu (sekcja MQTT) albo przy instalacji. Kiosk łączy się z
brokerem (np. Mosquitto w Home Assistant), publikuje:

| Temat | Treść |
|---|---|
| `<prefiks>/availability` | `online` / `offline` (retained, LWT) |
| `<prefiks>/state` | JSON ze stanem (retained; po każdej zmianie i co 30 s) |
| `<prefiks>/result` | wynik ostatniej komendy: `{"ok":…,"command":…,"output":…}` |

i przyjmuje komendy (prefiks domyślnie `kecaj/kiosk`):

| Temat | Treść | Działanie |
|---|---|---|
| `mode/set` | `web` \| `rtsp` \| `mix` \| `usb` | zmiana trybu, zawartość bez zmian |
| `view/set` | nazwa widoku | pokaż zapisany widok |
| `url/set` | `http://…` | nowy adres strony |
| `cameras/set` | `["rtsp://…","rtsp://…"]` lub adresy po przecinku | nowa lista kamer |
| `split/set` | `10`–`90` | mix: % szerokości strony |
| `set` | `{"mode":…,"url":…,"cameras":[…],"web_percent":…}` | kilka zmian naraz (pominięte pola bez zmian) |
| `bubble/set` | tekst lub `{"title","text","level","seconds","say","wake"}`; pusta treść ukrywa | dymek |
| `say/set` | tekst lub `{"text","voice","speed"}` | przeczytaj na głos |
| `play/set` | `http://…/plik.mp3` | odtwórz dźwięk |
| `stop/set` | dowolna | zatrzymaj dźwięk |
| `volume/set` | `0`–`100` | głośność |
| `screen/set` | `ON` \| `OFF` | monitor |
| `screen_timeout/set` | minuty (0 = nigdy) | wygaszanie po bezczynności |
| `shutdown_after/set` | minuty (0 = nigdy) | wyłączanie po starcie |
| `shutdown/set` | minuty (0 = teraz) \| `CANCEL` | jednorazowe wyłączenie |
| `restart/set` | dowolna | odśwież zawartość ekranu |
| `reboot/set` | dowolna | restart urządzenia |

```bash
B="-h 192.168.0.1 -u UZYTKOWNIK -P HASLO"
mosquitto_pub $B -t kecaj/kiosk/view/set -m salon
mosquitto_pub $B -t kecaj/kiosk/bubble/set -m '{"title":"Ktoś dzwoni","text":"Brama od ulicy","level":"warning","seconds":30,"say":true}'
mosquitto_pub $B -t kecaj/kiosk/screen/set -m OFF
mosquitto_sub $B -t 'kecaj/kiosk/#' -v
```

Przy kilku kioskach nadaj każdemu inny prefiks (np. `kecaj/salon`,
`kecaj/kuchnia`). Każdy, kto może publikować na brokerze, może sterować
kioskiem — zabezpiecz broker użytkownikiem i hasłem.

### Home Assistant (wykrywanie MQTT)

Z włączonym wykrywaniem kiosk sam pojawia się w HA jako urządzenie
„kecaj kiosk NAZWA_HOSTA” z encjami: Tryb, Widok (select), Adres strony
(text), Szerokość strony, Ekran (switch), Wygaszanie ekranu po, Wyłączenie
po starcie, Głośność (number), Dymek i Powiedz (notify), przyciski Odśwież
ekran / Restart / Wyłącz komputer / Zatrzymaj dźwięk oraz czujniki.

```yaml
# Dzwonek: pokaż kamerę wejścia, dymek i komunikat głosowy
automation:
  - alias: Dzwonek na kiosku
    trigger:
      - platform: state
        entity_id: binary_sensor.dzwonek
        to: "on"
    action:
      - service: select.select_option
        target: { entity_id: select.kecaj_kecaj_view }
        data: { option: wejście }
      - service: notify.send_message
        target: { entity_id: notify.kecaj_kecaj_bubble }
        data: { message: "Ktoś dzwoni do drzwi" }
      - service: tts.speak       # głos z HA przez odtwarzacz MPD kiosku
        target: { entity_id: tts.piper }
        data:
          media_player_entity_id: media_player.kiosk   # nazwa z integracji MPD
          message: "Ktoś dzwoni do drzwi"
```

Identyfikatory encji mają postać `<typ>.kecaj_<nazwa_hosta>_<encja>`, np. dla
hosta `kecaj`: `select.kecaj_kecaj_view`, `select.kecaj_kecaj_mode`,
`notify.kecaj_kecaj_bubble`, `notify.kecaj_kecaj_say`, `switch.kecaj_kecaj_screen`.

## API (HTTP)

Nagłówek `Authorization: Bearer TOKEN`, treść i odpowiedzi w JSON.

| Metoda i adres | Treść | Działanie |
|---|---|---|
| `GET /api/status` | — | tryb, widok, monitor, kamery, dźwięk, zaplanowane wyłączenie (hasła ukryte) |
| `GET /api/config` | — | pełna konfiguracja (z hasłami kamer) |
| `POST /api/mode` | `{"mode","url","cameras","usb_device","web_percent"}` | zmiana trybu/zawartości; pominięte pola bez zmian |
| `GET /api/views` | — | zapisane widoki |
| `POST /api/view` | `{"name":"salon"}` | pokaż widok |
| `POST /api/views` | `{"name":"salon"}` lub `{"name":…,"view":{…}}` | zapisz bieżący ekran / podany zestaw |
| `DELETE /api/views/NAZWA` | — | usuń widok |
| `POST /api/bubble` | `{"title","text","level","seconds","say","wake"}` lub `{"hide":true}` | dymek |
| `POST /api/say` | `{"text","voice":"pl","speed":150}` | mowa |
| `POST /api/audio` | `{"url":…}` \| `{"volume":40}` \| `{"stop":true}` | dźwięk |
| `POST /api/screen` | `{"on":false}` | monitor |
| `POST /api/power` | `{"screen_off_minutes":15,"shutdown_after_minutes":0}` | ustawienia trwałe |
| `POST /api/shutdown` | `{"in_minutes":30}` (0 = teraz) \| `{"cancel":true}` | jednorazowe wyłączenie |
| `GET` / `POST /api/mqtt` | `{"enabled","host","port","user","password","prefix","discovery"}` | ustawienia MQTT (puste hasło = bez zmian) |
| `POST /api/restart` | — | odśwież zawartość ekranu |
| `POST /api/reboot` | — | restart urządzenia |

```bash
T=TOKEN_Z_kiosk-mode_api-token
K=http://192.168.0.214:8088
curl -H "Authorization: Bearer $T" $K/api/status
curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"name":"salon"}' $K/api/view
curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"title":"Obiad","text":"Gotowy!","level":"ok","seconds":15,"say":true}' $K/api/bubble
curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"on":false}' $K/api/screen
```

Home Assistant bez MQTT — `rest_command` w `configuration.yaml`:

```yaml
rest_command:
  kiosk_view:
    url: http://192.168.0.214:8088/api/view
    method: POST
    headers: { Authorization: "Bearer TOKEN" }
    content_type: application/json
    payload: '{"name":"{{ name }}"}'
```

## Logo

Wbudowane logo kecaj (odręczny napis Caveat; ogonek litery „j” przechodzi
pod całym napisem i kończy się półstrzałką) w dwóch wersjach:

- **kiosk** (niebieski ekran) — tryb `web`,
- **stream** (bursztynowy obiektyw z lampką „live”) — tryby `rtsp` i `usb`.

Logo pokazuje się przy starcie systemu (Plymouth) i jako tło ekranu,
zanim załaduje się strona lub obraz kamery. `kiosk-mode` podmienia je
przy zmianie trybu. Własny plik PNG podany w konfiguracji pakietu
(`dpkg-reconfigure kiosk-setup`) ma pierwszeństwo w każdym trybie.

## SSH i konfiguracja sieci/WiFi

Pakiet włącza SSH od razu — cała konfiguracja (poza początkowym
`apt install`) odbywa się zdalnie. Kiosk uruchamia się automatycznie
zawsze, bez żadnego menu blokującego start.

Aby skonfigurować sieć (DHCP, statyczny IP, WiFi) po zalogowaniu
przez SSH:

```bash
sudo kiosk-netconfig.sh
```

Skrypt zapyta o interfejs, tryb (DHCP/statyczny) i — jeśli to
interfejs WiFi — o SSID i hasło, po czym zapisze konfigurację
w `/etc/netplan/90-kiosk-network.yaml` i opcjonalnie od razu ją
zastosuje.

## VNC (podgląd ekranu kiosku)

`x11vnc` udostępnia na porcie **5900** dokładnie tę sesję Xorg, którą
widać na ekranie kiosku (nie osobny wirtualny pulpit).

**Domyślne hasło to `kiosk` — zmień je od razu po instalacji:**

```bash
x11vnc -storepasswd NOWE_HASLO /etc/x11vnc.pass
sudo sed -i 's|-passwd kiosk|-rfbauth /etc/x11vnc.pass|' /etc/systemd/system/x11vnc.service
sudo systemctl daemon-reload && sudo systemctl restart x11vnc
```

Połącz się dowolnym klientem VNC pod adresem `<IP_serwera>:5900`.

## Watchdog IP

Co 5 minut (`/etc/cron.d/ip-watchdog`) sprawdzana jest łączność
(ping bramy domyślnej, a w razie braku — `1.1.1.1`). Po ok. 15
minutach bez łączności (3 kolejne nieudane próby) serwer automatycznie
się restartuje. Stan liczników: `/run/ip-watchdog.fails`.

## Dostęp SSH/VNC a firewall

Firewall (jeśli włączony) ogranicza **tylko ruch wychodzący** z tej
maszyny. Dla portów SSH (22) i VNC (5900) obowiązuje jeden z dwóch
trybów, wybierany podczas instalacji:

**Tryb domyślny** (pole "ograniczenie IP" zostawione puste) — SSH i VNC
dozwolone z całej sieci lokalnej (`10.0.0.0/8`, `172.16.0.0/12`,
`192.168.0.0/16`), z jawnymi regułami `ACCEPT` w `INPUT` — nigdy nie
zostaną przypadkiem zablokowane.

**Tryb ograniczony** (podano listę adresów IP) — SSH i VNC dozwolone
**wyłącznie** z podanych adresów/zakresów (np. adresu VPN-a), wszystko
inne na tych portach jest jawnie odrzucane (`DROP`). Przydatne, gdy
urządzenie jest w sieci współdzielonej z innymi i dostęp administracyjny
ma mieć tylko jeden konkretny host lub tunel VPN.

Aby zmienić tryb później:

```bash
sudo dpkg-reconfigure kiosk-setup
```

## Firewall

Jeśli wybrano ograniczenie firewalla, ruch wychodzący do internetu jest
domyślnie blokowany poza:

- siecią lokalną (10/8, 172.16/12, 192.168/16) — bez ograniczeń portów:
  Home Assistant, broker MQTT, kamery, głosy TTS
- adresem strony kiosku (host z URL)
- serwerami aktualizacji Ubuntu (archive.ubuntu.com, security.ubuntu.com
  i pokrewne)
- DNS (serwery z `/etc/resolv.conf`)
- DHCP i NTP

Lista adresów IP jest odświeżana co godzinę
(`/etc/cron.hourly/refresh-kiosk-firewall`), ponieważ adresy IP serwerów
Ubuntu/CDN mogą się zmieniać.

**Uwaga:** to ogranicza ruch *wychodzący z* tej maszyny. Nie blokuje
połączeń przychodzących (np. zdalnego SSH do tej maszyny z innego
komputera w sieci).

Ręczne odświeżenie listy dozwolonych adresów: `sudo kiosk-firewall refresh`.

Aby sprawdzić aktualne reguły:

```bash
sudo iptables -L OUTPUT -n -v
sudo ipset list kiosk_allowed
```

## Ograniczanie zapisów na dysk/kartę SD (IoT)

Pakiet automatycznie:

- przełącza `journald` na logi wyłącznie w RAM (`Storage=volatile`,
  limit 20 MB) — zero ciągłych zapisów logów systemowych na nośnik
- wyłącza `rsyslog`, jeśli jest obecny (uniknięcie duplikacji logów)
- montuje `/tmp` i `/var/log` jako `tmpfs` (RAM) po następnym restarcie
- zaostrza `logrotate` (dzienna rotacja, limit 10 MB) jako zabezpieczenie,
  gdyby `tmpfs` z jakiegoś powodu nie było zamontowane

### Dysk tylko do odczytu (panel → System → Dysk tylko do odczytu)

Chroni system przed uszkodzeniem przy nagłym odcięciu prądu i oszczędza dysk/kartę.
Gdy włączone, dysk jest montowany tylko do odczytu (pakiet `overlayroot`), a system,
przeglądarka i logi zapisują w pamięci RAM — po restarcie wszystko wraca do stanu
z dysku.

**Zmiany ustawień kiosku zostają.** Kiosk co 10 s sprawdza, czy zmieniły się jego
ustawienia — z panelu, z Home Assistant/MQTT albo z `kiosk-mode` w terminalu — i gdy
przestaną się zmieniać, zapisuje je na dysk: dysk na chwilę przechodzi w zapis (rw),
pliki są kopiowane i dysk wraca do odczytu (ro). Zapisywane są:
`/etc/kiosk-setup`, `/etc/hostname`, `/etc/hosts`, `/etc/lightdm`, `/etc/iptables`,
zdjęcia wygaszacza i głosy TTS; opcjonalnie nagrania z kamer (pole „Zachowuj nagrania”,
domyślnie nagrania są tylko w RAM).

```bash
sudo kiosk-ro status            # stan i zajęta pamięć RAM
sudo kiosk-ro on | off          # włącz / wyłącz — działa od następnego uruchomienia
sudo kiosk-ro save [ŚCIEŻKA…]   # zapisz na dysk teraz (bez ścieżki: ustawienia kiosku)
sudo kiosk-ro run apt-get upgrade   # polecenie na prawdziwym dysku (działa po restarcie)
```

Pierwsze włączenie instaluje pakiet `overlayroot` (potrzebny internet). Aktualizacje
kiosku z panelu (System → Aktualizacje) i nocne instalują się także na dysku. Inne
zmiany w systemie (instalacja programów, edycja plików poza listą wyżej) przepadną
przy restarcie — użyj `kiosk-ro run …`, `kiosk-ro save /ścieżka` albo wyłącz tryb na
czas zmian. Instalacja asystenta głosowego wymaga wyłączenia trybu.

## Panel administracyjny w Home Assistant (dodatek „Kioski”)

Osobny dodatek Home Assistant (`kiosk-ha-addon`) — jeden panel do wszystkich kiosków
w menu bocznym HA: stan każdego kiosku, pełny panel kiosku bez osobnego logowania,
akcje na wszystkich naraz (powiedz, dymek, widok, ekrany, odświeżenie, aktualizacja
z pliku `.deb`) i wyszukiwanie kiosków w sieci.

## Historia wersji

- **1.0.2** (16.10.2026) — nowe wyglądy zegara: „Oczy z zegarem” (para oczu rozgląda się,
  mruga i zerka na godzinę przy zmianie minuty) i „Same oczy” (bez godziny).
- **1.0.1** (16.10.2026) — pierwsze wydanie; zawiera wszystkie funkcje opisane w tej
  dokumentacji, w tym aktualizacje z GitHuba (`update.json`, suma SHA-256). Numer
  wersji pakietu: `1:1.0.1`.
