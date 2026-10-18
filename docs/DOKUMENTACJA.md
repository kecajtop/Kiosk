# Kiosk kecaj — dokumentacja

16 października 2026 · kecajtop

> Eksport dokumentu „Kiosk kecaj — dokumentacja”. Zrzuty ekranu: [docs/ZRZUTY.md](ZRZUTY.md).

## Przegląd

kiosk-setup (wersja 1.0.17) zamienia komputer z Ubuntu w kiosk: pokazuje kamery, stronę Home Assistant albo jedno i drugie, mówi, gra radio i reaguje na Home Assistant. Sterujesz nim z panelu WWW, z Home Assistant (MQTT), z API HTTP, z menu w terminalu albo dla wielu kiosków naraz z dodatku HA „Kioski”.

![Panel WWW kiosku — Pilot](img/panel-start.png)

Panel WWW: menu sekcji po lewej (Pilot, Kamery, Ekran, Komunikaty, Dźwięk, Automatyka, Połączenia, System), zakładki w sekcji, motyw ciemny lub jasny. Pilot to strona główna: „Teraz gra”, głośność, kafelki ulubionych stacji, widoki i ekran, „Powiedz”. Na telefonie na dole są trzy zakładki (Pilot, Kamery, Ustawienia), a Ustawienia to lista wszystkich sekcji. Na górze stan kiosku: tryb, monitor, kamery, dźwięk, połączenia i co gra.

| Element | Wartość |
| --- | --- |
| Kiosk | kecaj, 192.168.0.214, użytkownik `kecaj` |
| Home Assistant | 192.168.0.1:8123 |
| Kamera | rtsp://admin:…@192.168.0.203:554/ |
| Pakiet | kiosk-setup\_1.0.17\_amd64.deb (wersja 1:1.0.17, amd64, ok. 22 MB, zawiera Piper TTS); kod i wydania: github.com/kecajtop/Kiosk |

**Wymagania:** Ubuntu (Server albo z pulpitem), GRUB, procesor x86-64, monitor (do dwóch wyjść: HDMI, DisplayPort, VGA), sieć lokalna. Opcjonalnie: głośnik, mikrofon (interkom, asystent głosowy), monitor z DDC/CI (sterowanie podświetleniem).

**Porty kiosku**

| Port | Usługa |
| --- | --- |
| 8088 | Panel WWW i API (HTTP) |
| 8443 | Panel WWW i API (HTTPS) |
| 5900 | VNC — podgląd ekranu |
| 6600 | MPD — odtwarzacz dla Home Assistant |
| 49494 | Odtwarzacz DLNA (UPnP) |
| 10700 | Asystent głosowy (Wyoming), po instalacji |
| 22 | SSH |

**Logowanie do panelu:** dowolna nazwa użytkownika, hasło = token z `sudo kiosk-mode api-token`. Możesz też dodać konta (System → Konta).

**Na telefonie.** Na dole są trzy zakładki: Pilot (teraz gra, głośność, kafelki radia, ekran, „Powiedz”), Kamery (ekran kiosku na żywo — „▶ Na żywo”, podgląd albo sterowanie — i kamera na kiosku) i Ustawienia (lista wszystkich sekcji). Menu przeglądarki → „Dodaj do ekranu głównego” dodaje ikonę kiosku. **Aplikacja Kiosk na Androida** (`releases/kiosk-android-1.5.apk`, Android 5.0+) otwiera panel na pełnym ekranie, a fizyczne przyciski głośności telefonu sterują głośnością kiosku (przeglądarka zwykle ich nie przekazuje). Aplikacja sama znajduje kioski w sieci Wi-Fi, pamięta token lub konto domownika, a przy HTTPS prosi o potwierdzenie odcisku certyfikatu kiosku (System → Konta i dostęp). Ustawienia aplikacji: Ustawienia → „Aplikacja Kiosk”. Aplikacja ma też odtwarzacz w powiadomieniu i na ekranie blokady: okładka, tytuł, stacja, ⏮ ⏯ ⏭, a przyciski głośności telefonu sterują kioskiem także w tle. Nowe wersje aplikacja pobiera i instaluje sama z GitHuba (raz dziennie albo „Sprawdź aktualizację aplikacji”; „Aktualizuj aplikację automatycznie” w jej ustawieniach) i sprawdza ich sumę SHA-256. Po otwarciu aplikacja pokazuje Pilota (widok po otwarciu można zmienić w ustawieniach aplikacji).

## Instalacja i aktualizacja

Pierwsza instalacja to jedno polecenie i kreator; każda kolejna wersja zachowuje ustawienia.

**Pierwsza instalacja**

1. Użytkownik kiosku musi istnieć: `sudo adduser kecaj`.
2. Skopiuj pakiet na kiosk i zainstaluj:

   ```bash
   sudo apt update
   sudo apt install ./kiosk-setup_1.0.17_amd64.deb
   ```
3. Kreator zapyta o: użytkownika (`kecaj`), ekran (**desktop** = pulpit + kiosk na drugim monitorze, **kiosk** = cały komputer), tryb (web/rtsp/mix/usb), adres strony lub kamer, logo, firewall (przy pulpicie: **nie**), wyłączanie ekranu i komputera, MQTT, dostęp SSH/VNC.
4. Ustaw strefę czasową i uruchom ponownie: `sudo timedatectl set-timezone Europe/Warsaw`, potem `sudo reboot`.

Jeśli apt zgłosi niespełnione zależności: `sudo apt --fix-broken install`. Brak pakietów (mpv, feh): `sudo add-apt-repository universe`.

**Aktualizacja — trzy sposoby**

| Sposób | Jak |
| --- | --- |
| Panel WWW | System → „Wgraj nową wersję (.deb)”; postęp i dziennik na stronie |
| Automatycznie nocą | System → „Użyj GitHub” albo adres pakietu (np. `http://192.168.0.1:8123/local/kiosk-setup.deb` z folderu `www` w HA) + „Aktualizuj automatycznie”; codziennie ok. 3:30, tylko nowsza wersja; z GitHuba z kontrolą sumy SHA-256 |
| Terminal | `sudo apt install ./kiosk-setup_X_amd64.deb` albo `sudo kiosk-update file plik.deb` / `sudo kiosk-update check` |

Przy aktualizacji instalator pyta tylko: „Uruchomić kreator konfiguracji?”. **Nie** (domyślnie) zostawia wszystkie ustawienia; **Tak** przechodzi pytania z obecnymi wartościami jako podpowiedziami. Kreator później: `sudo dpkg-reconfigure kiosk-setup`. Instalacja bez pytań: `sudo DEBIAN_FRONTEND=noninteractive apt install ./kiosk-setup_*.deb`.

**Odinstalowanie:** `sudo apt remove kiosk-setup` (usuwa blokadę internetu, przywraca ekran logowania pulpitu) albo `sudo apt purge kiosk-setup` (także konfigurację). Zdjęcia i nagrania z kamer zostają w `/var/lib/kiosk-photos` i `/var/lib/kiosk-clips`.

### Aktualizacje z GitHuba i kod źródłowy

Kod, gotowy pakiet i plik aktualizacji są w [github.com/kecajtop/Kiosk](https://github.com/kecajtop/Kiosk). Kiosk sam sprawdza tam nowe wersje. Wpisz w panelu adres `https://raw.githubusercontent.com/kecajtop/Kiosk/main/update.json` (przycisk „Użyj GitHub”).

| Adres aktualizacji | Co robi kiosk |
| --- | --- |
| `update.json` z repozytorium | Czyta wersję, adres pakietu i sumę SHA-256; pobiera tylko nowszą wersję i sprawdza sumę |
| API wydań GitHub (`…/releases/latest`) | Bierze plik `kiosk-setup_*_amd64.deb` z wydania |
| Wprost plik `.deb` (np. z folderu `www` w HA) | Pobiera plik i instaluje, jeśli wersja w środku jest nowsza |

Przy adresie z GitHuba zapora kiosku sama przepuszcza serwery GitHuba. „Jaka wersja jest dostępna?” w panelu albo `sudo kiosk-update latest` tylko sprawdza, nic nie instaluje.

**Aktualizacje w Home Assistant.** Kiosk ma encję „Aktualizacja”: HA pokazuje zainstalowaną i dostępną wersję w Ustawienia → Aktualizacje, „Zainstaluj” aktualizuje kiosk, widać postęp. Przełącznik „Automatyczne aktualizacje” włącza nocne aktualizacje, przycisk „Sprawdź aktualizacje” sprawdza od razu (kiosk sprawdza też sam co 6 godzin). Dodatek Kioski pokazuje wersje wszystkich kiosków i aktualizuje je jednym przyciskiem; sam dodatek aktualizuje się przez HA (Ustawienia → Aktualizacje, na karcie dodatku przełącznik „Automatyczne aktualizacje”).

**Zasilanie z dodatku Kioski (1.3.0+).** Przy kiosku „Ustaw zasilanie…”: przekaźnik (encja HA) i Wake-on-LAN — MAC kiosk podaje sam. „Włącz” załącza przekaźnik i wysyła pakiety WOL, „Wyłącz” zamyka system kiosku, potem odcina prąd; są też „Włącz / Wyłącz wszystkie”. WOL trzeba włączyć w BIOS-ie/UEFI komputera.

**Paruj z HA.** W panelu kiosku: Połączenia → MQTT i Home Assistant → „Paruj z HA” otwiera parowanie na 5 minut; dodatek Kioski (1.2.0+) sam znajduje kiosk w sieci i dodaje go do listy, bez przepisywania tokenu. Jedno kliknięcie = jedno sparowanie.

**Podgląd ekranu w Home Assistant.** Integracja MJPEG IP Camera z adresem `http://<kiosk>:8088/api/screen/live?w=960&fps=5` i zdjęciem `http://<kiosk>:8088/api/screenshot` (konto domownika albo token) — gotowe adresy są w panelu: Połączenia → MQTT i Home Assistant. „Jaka wersja jest dostępna?” w panelu albo `sudo kiosk-update latest` tylko sprawdza, nic nie instaluje.

Bez ustawiania adresu: **Aktualizuj z GitHuba (wydanie)** instaluje najnowsze wydanie tej edycji (`sudo kiosk-update github`). **Aktualizuj z gita (najnowszy kod)** pobiera kod z gałęzi `main`, buduje na kiosku pakiet jego edycji (pełnej z głosami Piper albo light) i go instaluje — wersja np. `1:1.0.17+git20261018.abc1234` (`sudo kiosk-update git [gałąź]`). Na czas pobierania zapora dopuszcza serwery GitHuba.

**Numeracja.** Pakiet ma numer wersji `1:1.0.17`.

**Szybkie aktualizacje.** `update-grub` i `update-initramfs` uruchamiają się tylko po zmianie linii startowej (logo wł./wył.) albo motywu startowego (logo); wymuszenie: `sudo kiosk-bootlogo initramfs --force`.

**Budowanie ze źródeł.** Programy kiosku są w `kiosk-setup/src/`. Skrypt `kiosk-setup/build.sh` wkleja je do instalatora i buduje `.deb`; Piper bierze z gotowego pakietu (`--piper-from`) albo pomija (`--no-piper`). Panel WWW (HTML, CSS, JavaScript) jest wbudowany w `kiosk-setup/src/kiosk-api`.

**Nowe wydanie:** zmień `Version:` w `kiosk-setup/debian/control`, zbuduj pakiet, połóż go w `releases/` i wpisz wersję, adres, `sha256` oraz `size` w `update.json`.

### Wersja light

Pakiet `kiosk-setup-light` to lżejsza edycja kiosku dla słabszych komputerów: ok. 0,3 MB zamiast ok. 22 MB, bez espeak-ng i głosów Piper.

| Zostaje | Odpada |
| --- | --- |
| Strona WWW w Chromium, kamery RTSP, kamera USB, wszystkie zegary i widoki, monitory | Synteza mowy (Piper, espeak), mówiący zegar, czytanie komunikatów i dymków |
| Panel WWW, MQTT i auto-wykrycie w Home Assistant, automatyka ekranu, aktualizacje | Interkom i wiadomości głosowe |
| Muzyka: MPD, radio, odtwarzacz DLNA, głośność, karta „Teraz gra” | Asystent głosowy (Assist) |

Instalacja: `sudo apt install ./kiosk-setup-light_1.0.17_amd64.deb`. Pakiet zastępuje pełny (i odwrotnie), ustawienia zostają. Panel chowa zakładki z mową, a w Home Assistant znikają encje mowy.

Aktualizacje z GitHuba mają osobny plik: `https://raw.githubusercontent.com/kecajtop/Kiosk/main/update-light.json`; przycisk „Użyj GitHub” w wersji light wpisuje go sam. Kiosk nie zmienia edycji automatycznie — tylko przy ręcznej instalacji pliku albo przełączeniu edycji. Budowanie: `./build.sh --light`.

**Przełączanie edycji.** W panelu **System → Aktualizacje** widać zainstalowaną edycję i przycisk „Przełącz na wersję light” albo „Przełącz na wersję pełną”. Kiosk pobiera z GitHuba najnowszy pakiet drugiej edycji, sprawdza sumę SHA-256 i go instaluje; ustawienia zostają, a adres aktualizacji z GitHuba zostaje przestawiony na `update.json` albo `update-light.json`. W terminalu: `sudo kiosk-update switch light` albo `sudo kiosk-update switch full`. Przejście na light usuwa głosy Piper (ok. 22 MB), powrót na pełną pobiera je ponownie.

## Ekran, pulpit i monitory

Kiosk działa w jednym z dwóch trybów ekranu; zmiana w `sudo kiosk-mode` → Ekran albo `sudo kiosk-mode session desktop|kiosk`, potem restart.

| Tryb | Co się dzieje |
| --- | --- |
| **kiosk** | Cały komputer jako kiosk: autologin na tty1, startx, bez pulpitu. |
| **desktop** | Pulpit (Cinnamon, XFCE, KDE) na monitorze głównym z automatycznym logowaniem przez LightDM; kiosk na drugim wyjściu. Bez drugiego monitora kiosk czeka i sam się pojawia po podłączeniu. |

**Pulpit i LightDM** (tryb desktop, menu `sudo kiosk-mode`):

- **Pulpit:** wybór z zainstalowanych (Cinnamon — pasek na dole i przyciąganie okien jak w Windows; XFCE; KDE) albo „Zainstaluj inny pulpit”. Terminal: `sudo kiosk-mode desktop cinnamon`.
- **Logowanie:** automatyczne (kiosk startuje sam) albo z hasłem: `sudo kiosk-mode autologin yes|no`.
- Pulpit nie przykrywa kiosku: wygaszanie i blokadę ekranu wyłącz w ustawieniach pulpitu (Menedżer zasilania), bo obejmują oba monitory.
- Kiosk ma własny profil Chromium — przeglądarka na pulpicie jest od niego niezależna.

**Monitory** (panel → Monitory): wyjście, rozdzielczość, obrót; w trybie kiosk także lustro albo drugi ekran z osobnym widokiem (MQTT `second_view/set`). W trybie desktop wybierasz monitor kiosku; monitora pulpitu nie da się wybrać.

**Jasność** (Zasilanie → suwak, HA: liczba „Jasność ekranu”, MQTT `brightness/set` 5–100): metoda auto / DDC/CI / programowa. DDC/CI zmienia prawdziwe podświetlenie monitora (ddcutil, z odczytem kontrolnym); bez DDC/CI, np. przez VGA, działa programowo (xrandr). Pole „Odwrócona jasność” — dla monitorów z przerobionym podświetleniem LED, w których większa wartość ściemnia ekran.

**Automatyczna jasność wg słońca** (Zasilanie → „Automatyczna jasność wg położenia słońca”, jasność w nocy i w dzień, %): jasność rośnie o świcie i maleje o zmierzchu, bez ustalonych godzin (inaczej niż tryb nocny). Wysokość słońca: z encji `sun.sun` w Home Assistant (adres i token jak dla pogody), a bez HA — obliczona na kiosku z szerokości/długości geograficznej (Automatyka → Pogoda). Wyłącza się automatycznie na czas trybu nocnego (ma pierwszeństwo).

**Wyłączanie ekranu:** Zasilanie → przyciski i „wyłącz ekran po N min bez dotyku”; w trybie desktop „Wyłącz ekran” gasi tylko monitor kiosku.

**Logo przy starcie** (`sudo kiosk-mode` → Logo przy starcie albo `sudo kiosk-mode bootlogo on|off|once`): logo kecaj, bez logo na stałe (widać komunikaty systemu) albo bez logo tylko przy następnym starcie.

## Treść ekranu

To, co kiosk pokazuje, ustawiasz w panelu (zakładki Ekran i Widoki), z HA albo poleceniem `sudo kiosk-mode`.

| Tryb | Pokazuje | Polecenie |
| --- | --- | --- |
| web | Strona w Chromium (np. panel HA) na całym ekranie | `sudo kiosk-mode web http://192.168.0.1:8123` |
| rtsp | Kamery IP w siatce (1 kamera = cały ekran, 4 = 2×2) | `sudo kiosk-mode rtsp rtsp://kam1 rtsp://kam2` |
| mix | Strona po lewej, kamery po prawej (podział 10–90%) | `sudo kiosk-mode mix http://… rtsp://…` + `split 60` |
| usb | Kamera USB | `sudo kiosk-mode usb /dev/video0` |

- **Widoki:** zapisane zestawy (tryb + adres + kamery + zegar) przełączane jednym kliknięciem, z HA (lista „Widok”) i MQTT `view/set`.
- **Zegar:** w rogu (4 rogi, 3 rozmiary) albo jako kafelek w siatce kamer: `sudo kiosk-mode clock corner tr m`.
- **Pogoda:** przy zegarze i na głos; źródło Home Assistant (adres + token długoterminowy + encja `weather.*`) albo Open-Meteo. Ten sam adres i token HA wykorzystują obecność, kalendarz, pasek i powiadomienia.
- **Pasek informacyjny** (Automatyka): przewijany tekst na dole — własne teksty, stany encji HA, pogoda, plan dnia; chwilowy komunikat z HA (encja „Komunikat na pasku”, MQTT `ticker/set`).
- **Kalendarz** (Automatyka): encje `calendar.*` z HA — karta „Plan dnia” w rogu i wpisy na pasku, co 5 min.
- **Dymek:** komunikat na środku ekranu (tytuł, tekst, kolor: info/ok/warning/alert, czas), opcjonalnie czytany na głos; HA: notify „Dymek”, MQTT `bubble/set`.
- **Ekran na żywo:** VNC na porcie 5900; podgląd w panelu (Debug → „Zrób zrzut ekranu”) i kamera „Podgląd ekranu” w HA (co 60 s). W trybie desktop zrzut obejmuje tylko monitor kiosku.

### Zegary

Zegar ma 23 wyglądy do wyboru w panelu: Ekran → Co wyświetla kiosk → Wygląd zegara. Ten sam wygląd dotyczy nakładki w rogu, kafelka w siatce kamer i zegara nocnego, a zmiana działa od razu, bez mrugnięcia logo.

![Zegary kiosku: 23 wyglądy](img/zegary.png)

| Wygląd | Nazwa w `clock.json` | Sekundy | Uwagi |
| --- | --- | --- | --- |
| Klasyczny | `classic` | nie | Godzina i data |
| Klapkowy | `flip` | nie | Klapki jak w starym zegarze |
| Analogowy | `analog` | tak | Wskazówka sekundowa |
| Woltomierze | `volt` | tak | Trzy mierniki: godziny, minuty, sekundy |
| 7-segmentowy | `seg7` | tak | Zgaszone segmenty lekko widoczne |
| Matryca LED | `matrix` | nie | Cyfry z kropek |
| LCD 1602 | `lcd1602` | tak | Duże cyfry, dzień tygodnia |
| LCD 2004 | `lcd2004` | tak | Duże cyfry, data i pogoda |
| Wąż | `snake` | — | Animacja: wąż zjada kropki wokół godziny |
| Platformówka | `platform` | — | Animacja: robot podbija klocki z cyframi |
| Komputer 8-bit | `c64` | tak | Ekran w stylu komputera 8-bitowego |
| Niebieski ekran | `bsod` | — | „Kiosk napotkał nową minutę” |
| Oczy z zegarem | `eyes` | — | Animacja: oczy rozglądają się i mrugają, przy zmianie minuty zerkają na godzinę pod spodem |
| Same oczy | `eyes_only` | — | Animacja: same oczy na całe pole, bez godziny |
| Oczy robota z zegarem | `robot` | — | Animacja: świecące oczy z wyrazem (radość, smutek, złość, senność, zdziwienie), godzina pod spodem |
| Same oczy robota | `robot_only` | — | Animacja: oczy robota na całe pole |
| Zegar słowny (PL) | `words_pl` | — | Siatka liter, świecą słowa, np. „JEST ZA KWADRANS TRZECIA”; kropki w rogach = minuty |
| Zegar słowny (EN) | `words_en` | — | To samo po angielsku, np. „IT IS QUARTER TO THREE” |
| Zegar radiowy (LCD) | `dcf` | tak | Szarozielony LCD z masztem DCF, dniem tygodnia, datą i temperaturą |
| Kod czasu DCF77 | `dcf77` | tak | Pierścień sekund z bitami telegramu (minuta, godzina, data, parzystość); bieżący bit pulsuje |
| LED z pierścieniem | `ledring` | tak | Czerwone cyfry, 60 diod zapala się co sekundę |
| Minimalistyczny | `minimal` | tak | Jasna tarcza, cienkie wskazówki, płynny pomarańczowy sekundnik |
| Woltomierze kwadratowe | `voltsq` | tak | Trzy kwadratowe mierniki tablicowe, skala 90°, oś pod obudową w prawym dolnym rogu, zero przy podstawie |

Podświetlenie wyświetlaczy LCD: zielone, niebieskie albo bursztynowe (pole pod listy wyglądów). Zegar na cały ekran wyłącza się, wybierając w polu „Zegar” inne miejsce (w rogu albo brak) i klikając „Pokaż na kiosku”.

**Mimika podczas mowy.** Gdy kiosk mówi (komunikat, mówiący zegar, pogoda, wiadomość głosowa), oczy — ludzkie i robota — patrzą na rozmówcę, pulsują w rytm głosu, częściej mrugają i przybierają wyraz pasujący do treści. Słownik ma ok. 350 słów i fraz po polsku i angielsku, dopasowywanych od początku słowa („deszcz” pasuje też do „deszczowo”); wygrywa nastrój z największą liczbą trafień. Bez trafień: pytanie — zaciekawienie, wykrzyknik — zdziwienie.

| Wyraz oczu | Przykładowe słowa |
| --- | --- |
| Zdziwienie | uwaga, alarm, dym, zalanie, ktoś przy furtce, dzwonek, kurier, paczka, goście, otwarte okno, wykryto ruch, pilne |
| Złość | nie wolno, zakaz, przestań, za głośno, ostrzegam, ostatni raz, posprzątaj, stop |
| Smutek | niestety, deszcz, burza, mróz, pochmurno, przepraszam, błąd, nie działa, słaba bateria, odwołane, chory, szkoda |
| Senność | dobranoc, kolorowych snów, późno, pora spania, odpocznij, wieczór, zmęczony |
| Radość | dzień dobry, cześć, smacznego, obiad, słonecznie, ciepło, dziękuję, brawo, urodziny, święta, weekend, wakacje |
| Zaciekawienie | pamiętaj, przypominam, nie zapomnij, sprawdź, ciekawe, dlaczego, kto to |

### Na ekranie: ikony, aktualizacja, „Teraz gra”

Nad treścią kiosku program `kiosk-status` rysuje trzy małe elementy; ustawia się je w panelu: Ekran → Co wyświetla kiosk.

| Element | Co pokazuje | Ustawienia |
| --- | --- | --- |
| Ikony połączeń | LAN, Wi-Fi, internet, Home Assistant, MQTT — zielone, żółte albo czerwone; stan sprawdzany co 15 s | Róg ekranu albo wyłączone; „Tylko problemy” = ikony tylko przy awarii |
| Postęp aktualizacji | Karta z wersją „z → na”, procentem i bieżącym krokiem (pobieranie, instalacja) | Zawsze przy aktualizacji z panelu; nocna — tylko gdy jest nowsza wersja |
| Teraz gra | Stacja radia albo tytuł i wykonawca z MPD, DLNA/UPnP (np. z Home Assistant) albo ręcznie wpisanego adresu; okładka, gdy jest | Miejsce na dole lub górze ekranu albo wyłączone |

Stan ikon jest też w panelu WWW, w pasku pod nazwą kiosku. Kursor myszy jest ukryty na wszystkich nakładkach.

## Dźwięk i mowa

Kiosk mówi (TTS), gra radio i dźwięki, a przed każdym komunikatem gra gong i ścisza muzykę. Ustawienia: panel → Dźwięk.

**Głosy** (Piper + efekty; pobranie: `sudo kiosk-voice install`)

| Głos | Charakter |
| --- | --- |
| jarvis | Męski, spokojny, cyfrowy pogłos (domyślny) |
| jarvis-en | Brytyjski angielski w tym samym stylu |
| lektorka | Ciepły, spokojny głos jak w filmie przyrodniczym |
| kobieta / mezczyzna | Naturalne, bez efektów |
| robot | Syntetyczny |
| espeak | Awaryjny, zawsze dostępny |

- **Gong i przyciszanie:** gong „jak na lotnisku” (wyłączalny) i suwak „Muzyka podczas komunikatu” (domyślnie 40%). Komunikaty idą po kolei i nie przerywają muzyki. Bez gongu dla jednego: `{"text":"…","chime":false}` na `say/set`.
- **Mówiący zegar i pogoda:** przyciski w panelu, HA (przyciski), MQTT `time/set`, `weather/set`.
- **Radio internetowe:** wyszukiwarka stacji (radio-browser.info), ulubione, graj/stop; HA: lista „Radio” (MQTT `radio/set` nazwa albo `OFF`). Budzik: harmonogram → „Radio (budzik)”, głośność narasta przez minutę.
- **Wiadomość głosowa:** „Nagraj / wybierz nagranie” — na telefonie otwiera dyktafon, nagranie gra na kiosku po gongu. Z HA: MQTT `message/set` z adresem pliku audio.
- **Interkom:** „Posłuchaj kiosku (10 s)” — nagranie z mikrofonu kiosku; potrzebny mikrofon.
- **Odtwarzacz dla HA:** kiosk ogłasza się jako **DLNA** „kecaj kiosk” (HA wykrywa sam: Urządzenia i usługi → Wykryto). Alternatywa: integracja **Music Player Daemon** (host 192.168.0.214, port 6600, hasło = token). Nazwa i wyjście DLNA: `/etc/kiosk-setup/dlna.env`.
- **Asystent głosowy (Assist):** Dźwięk → „Zainstaluj” albo `sudo kiosk-satellite install` (pobiera ok. 50 MB z PyPI). Kiosk staje się satelitą Wyoming; HA wykryje go sam. W HA potrzebne dodatki: openWakeWord (słowo np. „Hey Jarvis”), Whisper albo HA Cloud, Piper. Wymaga mikrofonu.

Głośność: suwak w panelu, HA (liczba „Głośność”), MQTT `volume/set` 0–100.

## Automatyka

Zakładka Automatyka zbiera wszystko, co kiosk robi sam. Gdy kilka rzeczy chce ekranu naraz, pierwszeństwo ma: alarm, potem zegar nocny, potem wygaszacz ze zdjęciami, a na końcu zwykła treść lub rotacja.

| Funkcja | Co robi | Sterowanie z HA / MQTT |
| --- | --- | --- |
| Alarm z kamerą | Kamera (albo widok/strona) na cały ekran na N s, gong, dymek, opcjonalnie nagranie; budzi ekran | `alert/set` `{"camera":1,"seconds":30,"title":"Dzwonek"}`; `OFF` kończy; przycisk „Zakończ alarm” |
| Harmonogram | O godzinie i w dni tygodnia: widok, ekran wył./wł., powiedz tekst, odśwież, radio (budzik), wyłącz radio | — (w panelu) |
| Obecność | Po N min bez ruchu: wyłącz ekran albo pokaż zdjęcia; ruch: zwykły ekran | encja HA (sprawdzana co 3 s) albo `presence/set` `ON`/`OFF` |
| Rotacja widoków | Zaznaczone widoki po kolei co N s | przełącznik „Rotacja widoków”, `rotation/set` |
| Tryb nocny | W godzinach od–do: przyciemnienie i sam duży zegar | przełącznik „Tryb nocny”, `night/set` `ON`/`OFF`/`AUTO` |
| Zdjęcia | Pokaz zdjęć na całym ekranie; wgrywane w panelu | `photos/set` `ON`/`OFF` |
| Ruch na kamerach | Porównuje klatki kluczowe (co 1–4 s); czułość 1–10, zacznij od 6–7 | czujnik „Ruch kamera N” |
| Nagrania | 20 s przy ruchu lub alarmie, „Nagraj teraz”; lista, odtwarzanie, pobieranie | — |
| Frigate / go2rtc | Podajesz adres serwera, kiosk proponuje strumienie `rtsp://serwer:8554/nazwa` | — |
| Rozpoznawanie twarzy | Wykrywa twarze (YuNet) i rozpoznaje dodane osoby (SFace) lokalnie na kiosku; powitanie głosem, alarm z kamerą, nagranie nieznanej osoby | czujniki „Twarze kamera N”, „Osoba kamera N”, zdarzenie „Twarz” |
|  |  |  |

**Czujnik ruchu zamiast kamery (zalecane):** dodaj czujnik do HA (Zigbee, Z-Wave, WiFi, ESPHome), potem Automatyka → Obecność → encja np. `binary_sensor.ruch_salon`. Czujnik PIR nie widzi osoby siedzącej bez ruchu — ustaw 15–20 min; czujnik obecności mmWave (np. Aqara FP2, LD2410 na ESPHome) widzi także nieruchome osoby. Czujnik przy kiosku: ESP32 z PIR/LD2410 zasilany z USB kiosku, dane przez WiFi do HA.

Nagrania z kamer H.265 zapisują się, ale nie każda przeglądarka je odtworzy — wtedy „Pobierz”. Limit: 200 plików albo 3 GB, najstarsze są usuwane.

**Rozpoznawanie twarzy (lokalnie).** Automatyka → Rozpoznawanie twarzy → „Zainstaluj” (albo `sudo kiosk-faces install`) pobiera OpenCV oraz modele YuNet (wykrywanie) i SFace (rozpoznawanie): ok. 100 MB z internetu, ok. 300 MB na dysku. Obraz, zdjęcia osób i wyniki zostają na kiosku; zdjęcia osób są w `/etc/kiosk-setup/faces` (tylko root, poza kopią ustawień). Osobę dodajesz zdjęciem albo przyciskiem „Zapisz twarz z kamery” (najlepiej 2–5 razy). W HA: czujniki „Twarze kamera N” i „Osoba kamera N” oraz zdarzenie „Twarz” (`rozpoznana` / `nieznana`, atrybuty `osoba`, `kamera`, `podobienstwo`). Kiosk może przywitać rozpoznaną osobę głosem, a przy nieznanej pokazać alarm z kamerą i nagrać 20 s. Przy 960 px i 2 analizach na sekundę zajmuje ok. 1/3 rdzenia na kamerę.

![Automatyka → Rozpoznawanie twarzy](img/panel-twarze.png)

## Home Assistant

Po połączeniu z brokerem MQTT kiosk sam pojawia się w HA jako urządzenie „kecaj kiosk kecaj” — bez YAML.

**Połączenie (raz)**

1. HA: Ustawienia → Dodatki → **Mosquitto broker** → zainstaluj, uruchom; zatwierdź integrację **MQTT**.
2. HA: Ustawienia → Osoby → Użytkownicy → dodaj użytkownika, np. `kiosk` (Mosquitto przyjmuje loginy HA).
3. Kiosk: panel → MQTT → „Wykryj broker w sieci” → „Użyj” przy 192.168.0.1 → użytkownik i hasło → Zapisz. Terminal: `sudo kiosk-mode` → Home Assistant (MQTT).
4. HA: Urządzenia i usługi → MQTT → „kecaj kiosk kecaj”. Po restarcie HA kiosk sam ogłasza encje ponownie.
5. Głośnik: Urządzenia i usługi → Wykryto: „kecaj kiosk” (DLNA) → Skonfiguruj.

**Encje kiosku w HA**

| Typ | Encje |
| --- | --- |
| Wybór | Tryb, Widok, Widok na drugim ekranie, Zegar, Pozycja zegara, Głos, Radio |
| Przełączniki | Ekran, Tryb nocny, Rotacja widoków |
| Liczby | Głośność, Jasność ekranu, Podział mix, Wygaszanie ekranu, Wyłączenie po starcie |
| Tekst | Adres strony, Komunikat na pasku |
| Notify | Dymek, Powiedz |
| Przyciski | Odśwież ekran, Restart, Wyłącz, Powiedz godzinę (+ z datą), Powiedz pogodę, Zatrzymaj dźwięk, Zakończ alarm |
| Czujniki | Dźwięk, Aktywne kamery, Alarm na ekranie, Ruch kamera N, Sesja ekranu, Czas pracy, Temperatura procesora, Obciążenie, Wolna pamięć, Wolne miejsce, Pobór mocy procesora (Intel) |
| Kamera | Podgląd ekranu (zrzut co 60 s) |

**Notify:** w nowszym HA nazwa encji pochodzi od urządzenia, np. `notify.kecaj_kiosk_kecaj_powiedz` — sprawdź w Ustawienia → Encje (szukaj „powiedz”). Akcja zawsze `notify.send_message`:

```yaml
action: notify.send_message
target:
  entity_id: notify.kecaj_kiosk_kecaj_powiedz
data:
  message: "Pranie skończone"
```

**Dzwonek: kamera na ekran z gongiem i głosem**

```yaml
triggers:
  - trigger: state
    entity_id: binary_sensor.dzwonek
    to: "on"
actions:
  - action: mqtt.publish
    data:
      topic: kecaj/kiosk/alert/set
      payload: '{"camera": 1, "seconds": 30, "title": "Dzwonek", "text": "Ktoś przy furtce", "say": true}'
```

**Inny głos lub tempo:** `mqtt.publish` na `kecaj/kiosk/say/set` z `{"text": "…", "voice": "jarvis", "speed": 140}`.

### Dodatek Home Assistant „Kioski”

Wszystkie kioski są w jednym panelu w menu bocznym Home Assistant, otwieranym przez Ingress, bez osobnego logowania. Dodatek jest w tym samym repozytorium GitHub co pakiet.

![Dodatek „Kioski” w Home Assistant](img/dodatek-ha.png)

**Instalacja**

1. W HA: Ustawienia → Dodatki → Sklep z dodatkami → ⋮ → Repozytoria.
2. Dodaj `https://github.com/kecajtop/Kiosk`.
3. Zainstaluj „Kioski” i włącz „Pokaż w pasku bocznym”.

Nowe wersje dodatku pojawiają się w HA jako zwykłe aktualizacje. Dodatek działa na aarch64 i amd64.

**Co potrafi**

- **Szukaj w sieci** znajduje kioski w sieciach Home Assistant. **Dodaj kiosk** zapisuje kiosk z adresem i tokenem API; token zostaje tylko w dodatku.
- Karta każdego kiosku: stan ekranu, monitora, kamer, sieci, czas pracy i „Teraz gra”.
- **Otwórz panel** otwiera panel kiosku wewnątrz HA (z paskiem powrotu), bez osobnego logowania.
- **Wszystkie kioski naraz:** „powiedz”, dymek, widok, włączenie i wyłączenie ekranów, odświeżenie, wgranie `.deb` na wszystkie i sprawdzenie adresu aktualizacji.

### Wi-Fi

Kiosk może działać przez Wi-Fi; ustawia się je w panelu: Połączenia → Wi-Fi i sieć (w terminalu: `sudo kiosk-netconfig.sh`).

- **Stan:** sieć, siła sygnału, adres i oszczędzanie energii każdej karty Wi-Fi; to samo w Diagnostyce.
- **Połącz:** „Szukaj sieci”, hasło, DHCP albo stały adres (adres z maską, brama, DNS). Masz 2 minuty na „Działa — zachowaj ustawienia”; bez potwierdzenia kiosk sam wraca do poprzednich ustawień, gdyby zniknął z sieci. Puste hasło przy tej samej sieci = bez zmiany, przy innej = sieć otwarta.
- **Oszczędzanie energii karty Wi-Fi jest wyłączone** — inaczej kiosk bywa nieosiągalny dla panelu, SSH i VNC. Pakiet instaluje `wpasupplicant` (bez niego Wi-Fi na Ubuntu Server się nie łączy) i `iw`.
- Ustawienia są w `/etc/netplan/90-kiosk-network.yaml`; przy dysku tylko do odczytu zapisują się także na dysk.

Jeśli kiosk jest na kablu, a nie da się na niego wejść z telefonu w Wi-Fi, przyczyna jest zwykle w routerze: sieć gościnna albo „separacja klientów” (AP isolation).

## MQTT, API i terminal

Wszystkie tematy MQTT mają prefiks `kecaj/kiosk/`. Wynik każdej komendy trafia na `kecaj/kiosk/result`, pełny stan na `kecaj/kiosk/state`, dostępność na `kecaj/kiosk/availability`. Te same komendy wykonasz w panelu (Debug → Konsola komend) i przez `POST /api/debug/command`.

Prefiks zmienia się razem z nazwą kiosku (System → Nazwa kiosku), np. `kiosk/salon`. Przykłady poniżej używają dotychczasowego `kecaj/kiosk`.

**Tematy MQTT (`<prefiks>/…`)**

| Temat | Treść | Działanie |
| --- | --- | --- |
| `set` | `{"mode","url","cameras","web_percent"}` | kilka zmian naraz |
| `mode/set` | `web` \| `rtsp` \| `mix` \| `usb` | tryb |
| `view/set` | nazwa widoku | pokaż widok |
| `url/set`, `cameras/set`, `split/set` | adres / lista kamer / 10–90 | treść |
| `clock/set`, `clock_position/set` | off\|corner\|tile / tl\|tr\|bl\|br | zegar |
| `second_view/set` | nazwa widoku albo `OFF` | drugi monitor |
| `bubble/set` | tekst lub `{"title","text","level","seconds","say"}` | dymek |
| `say/set` | tekst lub `{"text","voice","speed","chime"}` | powiedz |
| `time/set`, `weather/set` | `{"date":true}` / `{}` | godzina, pogoda na głos |
| `voice/set`, `volume/set` | głos / 0–100 | dźwięk |
| `play/set`, `stop/set` | adres audio / dowolna | odtwórz, zatrzymaj |
| `message/set` | `{"url":"http://…/plik.mp3"}` | wiadomość z gongiem |
| `radio/set` | nazwa stacji albo `OFF` | radio |
| `alert/set` | `{"camera","view","url","seconds","title","text","say"}` / `OFF` | alarm |
| `presence/set` | `ON` / `OFF` | obecność |
| `ticker/set` | tekst lub `{"text","minutes"}` | komunikat na pasku |
| `night/set`, `rotation/set`, `photos/set` | `ON` / `OFF` (noc: też `AUTO`) | noc, rotacja, zdjęcia |
| `brightness/set` | 5–100 | jasność |
| `screen/set` | `ON` / `OFF` | monitor |
| `screen_timeout/set`, `shutdown_after/set` | minuty | wygaszanie, wyłączanie |
| `shutdown/set` | minuty / `CANCEL` | jednorazowe wyłączenie |
| `restart/set`, `reboot/set` | dowolna | odśwież ekran, restart |

**API HTTP** (`http://192.168.0.214:8088`, nagłówek `Authorization: Bearer <token>`; pełna lista w panelu → Jak używać):

```bash
T=$(sudo cat /etc/kiosk-setup/api-token)
curl -H "Authorization: Bearer $T" http://192.168.0.214:8088/api/status
curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
     -d '{"command":"bubble/set","payload":"Obiad!"}' http://192.168.0.214:8088/api/debug/command
```

Najważniejsze adresy: `GET /api/status`, `/api/config`, `/api/views`, `/api/screenshot`, `/api/debug/report`, `/api/backup`; `POST /api/mode`, `/api/view`, `/api/bubble`, `/api/say`, `/api/audio`, `/api/alert`, `/api/screen`, `/api/brightness`, `/api/radio/play`.

**Terminal (`sudo kiosk-mode`)**

| Polecenie | Działanie |
| --- | --- |
| `sudo kiosk-mode` | menu: treść, ekran, pulpit, logowanie, HA, firewall, logo, stan, diagnostyka |
| `sudo kiosk-mode status` / `debug` | stan / pełny raport |
| `sudo kiosk-mode web\|rtsp\|mix\|usb …` | tryb i treść |
| `sudo kiosk-mode reload` / `restart` | odśwież treść / restart ekranu |
| `sudo kiosk-mode session desktop\|kiosk` | tryb ekranu |
| `sudo kiosk-mode desktop cinnamon` / `autologin yes\|no` | pulpit, logowanie |
| `sudo kiosk-mode firewall on\|off\|status` | blokada internetu |
| `sudo kiosk-mode bootlogo on\|off\|once` | logo przy starcie |
| `sudo kiosk-mode mqtt-detect` | szukaj brokera MQTT |
| `sudo kiosk-mode api-token` | adres i hasło panelu |
| `sudo kiosk-voice install` | pobierz głosy Piper |
| `sudo kiosk-satellite install\|remove\|status` | asystent głosowy |
| `sudo kiosk-update check` / `file plik.deb` | aktualizacja |
| `sudo kiosk-power screen on\|off`, `shutdown N`, `cancel` | ekran, zasilanie |

### Nazwa kiosku

Każdy kiosk ma własną nazwę, np. Salon albo Kuchnia (panel → System → Nazwa kiosku, terminal: `sudo kiosk-mode name` "Salon"). Z nazwy powstają trzy rzeczy, wszystkie do ręcznej zmiany:

| Co | Przykład dla „Salon” |
| --- | --- |
| Nazwa urządzenia w HA, odtwarzacza DLNA i asystenta | Kiosk Salon |
| Nazwa komputera (hostname) | `salon` |
| Tematy MQTT | `kiosk/salon/…` |

Identyfikatory encji w HA zostają przy zmianie nazwy, więc automatyzacje działają dalej. Pole „Nowe identyfikatory encji” tworzy urządzenie od nowa; stare encje znikają z HA i automatyzacje trzeba poprawić.

### Dysk tylko do odczytu

W zwykłej pracy dysk może być tylko do odczytu (overlayroot): wszystkie zapisy idą do pamięci RAM i znikają po restarcie, więc nagłe wyłączenie prądu nie uszkodzi systemu. Włączanie: panel → System → Dysk tylko do odczytu albo `sudo kiosk-ro on`; działa od następnego uruchomienia, za pierwszym razem instaluje pakiet overlayroot.

- Zmiany ustawień z panelu kiosk sam zapisuje na dysk: na chwilę przełącza go do zapisu, zapisuje pliki i wraca do trybu tylko do odczytu.
- Aktualizacja pakietu (`kiosk-update`) instaluje się na dysku i w bieżącym systemie, więc zostaje po restarcie.
- Nagrania z kamer domyślnie są tylko w RAM; opcja „Zachowuj nagrania z kamer po restarcie” zapisuje je na dysk.
- Asystent głosowy instaluje się tylko przy wyłączonym trybie (`sudo kiosk-ro off`, restart).
- Po zmianach w terminalu (`kiosk-mode`, edycja plików) wpisz `sudo kiosk-ro save`, inaczej znikną po restarcie.

| Polecenie | Działanie |
| --- | --- |
| `sudo kiosk-ro status` | Czy włączone, zajętość RAM, ostatni zapis |
| `sudo kiosk-ro on` / `off` | Włącz / wyłącz od następnego uruchomienia |
| `sudo kiosk-ro save [pliki]` | Zapisz ustawienia (albo podane pliki) na dysk |
| `sudo kiosk-ro run POLECENIE` | Uruchom polecenie na dysku, np. instalację pakietu |

## Bezpieczeństwo i zarządzanie

Kiosk nie wystawia niczego do internetu; panel i API wymagają tokenu albo konta, a blokada internetu jest opcjonalna.

- **Firewall (blokada internetu):** gdy włączony, do internetu tylko adres strony kiosku, serwery Ubuntu i adres aktualizacji; sieć lokalna bez ograniczeń. Na komputerze z pulpitem zostaw wyłączony — inaczej przeglądarka nie otworzy stron. `sudo kiosk-firewall on|off|status`, menu `sudo kiosk-mode` → Blokada internetu. Ograniczenie SSH/VNC/panelu do wybranych adresów: `ADMIN_IPS` w `/etc/kiosk-setup/firewall.conf`, potem `sudo kiosk-firewall on`.
- **HTTPS:** panel także na `https://192.168.0.214:8443` (certyfikat kiosku ważny 10 lat — przeglądarka raz ostrzeże). Przez HTTPS działa nagrywanie w przeglądarce. Własny certyfikat: `/etc/kiosk-setup/tls/cert.pem` i `key.pem`, potem `sudo systemctl restart kiosk-api`.
- **Konta** (System → Konta): administrator (wszystko) albo domownik (widoki, dymek, dźwięk i radio, ekran wył./wł.). Token panelu zawsze działa jako administrator. Hasła kont są haszowane (PBKDF2).
- **Kopia ustawień** (System): „Pobierz kopię (.tar.gz)” — wszystkie ustawienia, także hasła kamer i MQTT; „Przywróć z pliku” działa też na innym kiosku (użytkownik kiosku zostaje miejscowy).
- **Kilka kiosków** (System → Kioski w sieci): „Szukaj w sieci”, dodanie (adres + token tamtego kiosku), komenda na wszystkie naraz, „Kopiuj ustawienia tam”.
- **Powiadomienia na telefon** (Zasilanie): usługa HA, np. `notify.mobile_app_telefon`. Gdy przez 3 min ekran nie działa, brakuje kamer, kończy się miejsce lub pamięć, rośnie temperatura albo znika MQTT — powiadomienie; po naprawie drugie. Opcjonalnie wyłączenie komputera powyżej podanej temperatury (60–105 °C). Gdy kiosk całkiem przestanie działać, w HA będzie „niedostępny” — na to zrób automatyzację w HA.
- **Hasła i tokeny:** token panelu `/etc/kiosk-setup/api-token` (też hasło MPD); hasła MQTT, kamer i token HA w plikach 0600/0640 w `/etc/kiosk-setup`. W raporcie diagnostycznym są ukryte.

## Diagnostyka i problemy

Zacznij od panelu → Debug → „Sprawdź”: zielone, czerwone i szare kropki dla usług, ekranu, sieci, każdej kamery, MQTT i zasobów. „Pobierz pełny raport (.txt)” zbiera wszystko z ukrytymi hasłami.

**Dzienniki** — panel → Debug → Dziennik („Na żywo”, filtr) albo w terminalu:

```bash
sudo kiosk-mode debug                 # raport w terminalu
tail -f ~/.kiosk-session.log          # ekran kiosku: mpv, Chromium, zegar, pasek (jako kecaj)
journalctl -u kiosk-api -f            # panel, API, MQTT
journalctl -u kiosk-mpd -n 50         # dźwięk MPD
journalctl -u kiosk-dlna -n 50        # odtwarzacz DLNA
journalctl -u kiosk-satellite -n 50   # asystent głosowy
cat /var/log/kiosk-update.log         # aktualizacje
journalctl -b -p warning              # ostrzeżenia systemu od startu
```

**Typowe problemy**

| Objaw | Przyczyna i rozwiązanie |
| --- | --- |
| Brak internetu w przeglądarce, ping działa | Firewall kiosku (ping zawsze przechodzi): `sudo kiosk-firewall off` |
| Czarny ekran po starcie | `cat ~/.kiosk-session.log`; Debug → Serwer X; startx nie działa przez SSH — tylko z konsoli |
| Zamiast pulpitu kiosk na całym ekranie | Tryb ekranu „kiosk”: `sudo kiosk-mode session desktop`, restart |
| Kiosk nie pojawia się na drugim monitorze | Monitor nie wykryty: Monitory → lista wyjść; Debug → „Monitor kiosku” |
| Obraz z kamery opóźniony | Niższa rozdzielczość strumienia albo restream przez go2rtc/Frigate |
| Cisza przy „Powiedz” | Debug → Dziennik → Dźwięk; „device busy” = dźwięk pulpitu zajął kartę |
| Zła godzina w mówiącym zegarze | `sudo timedatectl set-timezone Europe/Warsaw`, `sudo systemctl restart kiosk-api` |
| Brak encji w HA | Panel → MQTT: zielona kropka i „Automatyczne wykrywanie”; HA → MQTT → nasłuchuj `homeassistant/#` |
| Brak `notify.kecaj_kecaj_say` | Nowsze HA: `notify.kecaj_kiosk_kecaj_powiedz` — sprawdź w Encjach |
| VNC nie odświeża obrazu kamer | Podgląd mpv przez GPU: `KIOSK_MPV_EXTRA='--vo=x11'` w kiosk.conf (więcej CPU) |
| apt: niespełnione zależności | `sudo apt --fix-broken install`; brak mpv/feh → `sudo add-apt-repository universe` |
| Fałszywe alarmy ruchu z kamery | Zmniejsz czułość o 1 albo użyj czujnika ruchu z HA |

## Pliki, usługi i katalogi kiosku

Mapa wszystkiego, co pakiet instaluje. Przydaje się przy ręcznej diagnostyce, kopii zapasowej i przenoszeniu kiosku na inny komputer.

### Skrypty

| Ścieżka | Do czego służy |
| --- | --- |
| `/usr/local/bin/kiosk-session` | Pętla sesji X: uruchamia układ, pilnuje restartów, log w `~/.kiosk-session.log` |
| `/usr/local/bin/kiosk-layout` | Rozkład okien na monitorze kiosku: kamery, przeglądarka, zegar, zdjęcia, alert |
| `/usr/local/bin/kiosk-display` | Monitory: xrandr, wybór wyjścia, obrót, jasność |
| `/usr/local/bin/kiosk-bubble` | Dymek z komunikatem na ekranie |
| `/usr/local/bin/kiosk-clock` | Zegar: 23 wyglądy; nakładka w rogu, kafelek w siatce, zegar nocny; zmiana wyglądu bez przeładowania |
| `/usr/local/bin/kiosk-status` | Ikony połączeń, postęp aktualizacji i karta „Teraz gra” na ekranie |
| `/usr/local/bin/kiosk-ticker` | Przewijany pasek informacyjny na dole ekranu |
| `/usr/local/bin/kiosk-agenda` | Plan dnia z kalendarzy HA w rogu ekranu |
| `/usr/local/sbin/kiosk-mode` | Menu administracyjne (tryby, firewall, logo, sesja) |
| `/usr/local/sbin/kiosk-api` | Panel WWW, API, MQTT/HA, zapowiedzi, kamery, radio |
| `/usr/local/sbin/kiosk-power` | Harmonogram włączania i wyłączania ekranu |
| `/usr/local/sbin/kiosk-voice` | Instalacja głosów TTS (Piper) |
| `/usr/local/sbin/kiosk-firewall` | `status` / `on` / `off` / `refresh` |
| `/usr/local/sbin/kiosk-session-mode` | Przełączanie: sam kiosk / pulpit + kiosk |
| `/usr/local/sbin/kiosk-bootlogo` | Logo przy starcie, tymczasowe wyłączenie |
| `/usr/local/sbin/kiosk-update` | `file` / `check` / `auto` / latest — aktualizacja pakietu (także z GitHuba, z postępem na ekranie) z zachowaniem ustawień |
| `/usr/local/sbin/kiosk-satellite` | `install` / `remove` / `status` — asystent głosowy HA (Wyoming) |
| `/usr/local/sbin/kiosk-ro` | `status` / `on` / `off` / `save` / `run` — dysk tylko do odczytu (overlayroot) |
| `/usr/local/sbin/kiosk-netconfig.sh` | Ustawienia sieci z kreatora |

### Usługi systemd

| Jednostka | Opis |
| --- | --- |
| `kiosk-api.service` | Panel WWW (8088, HTTPS 8443), API, MQTT |
| `kiosk-mpd.service` | Odtwarzacz muzyki MPD (port 6600) |
| `kiosk-dlna.service` | Odtwarzacz DLNA gmediarender (port 49494) |
| `kiosk-satellite.service` | Asystent głosowy (port 10700), tylko po `kiosk-satellite install` |
| `kiosk-power.service` | Harmonogram ekranu |
| `kiosk-bootlogo.service` | Logo startowe |
| `x11vnc.service` | Podgląd ekranu przez VNC (5900) |
| `kiosk-update.timer` | Nocna aktualizacja o 3:30 (gdy włączona) |

### Konfiguracja — `/etc/kiosk-setup/`

| Plik | Zawartość |
| --- | --- |
| `kiosk.conf` | Adres HA, kamery RTSP, tryb, monitor |
| `name.json`, `device-id` | Nazwa kiosku, stały identyfikator urządzenia w HA |
| `clock.json` | Wygląd zegara i podświetlenie LCD |
| `ro.conf` | Dysk tylko do odczytu: dodatkowe ścieżki do zapisu, zachowywanie nagrań |
| `session.conf` | `KIOSK_SESSION`, `KIOSK_AUTOLOGIN`, `KIOSK_DESKTOP` |
| `displays.conf`, `second.conf` | Monitory i drugie wyjście |
| `views.json`, `rotation.json` | Widoki i ich rotacja |
| `mqtt.json`, `notify.json`, `peers.json` | Broker MQTT, powiadomienia, inne kioski |
| `weather.json`, `calendar.json`, `ticker.json`, `ticker.conf` | Pogoda, plan dnia, pasek |
| `voice.json`, `radio.json` | Głos TTS, stacje radiowe |
| `schedule.json`, `presence.json`, `night.json`, `brightness.json` | Harmonogram, obecność, tryb nocny, jasność |
| `motion.json` | Wykrywanie ruchu na kamerach |
| `overlay.conf`, `boot.conf` | Nakładki ekranu, logo startowe |
| `firewall.conf` | `ADMIN_IPS` — kto ma dostęp do SSH/VNC/panelu |
| `updates.conf` | `UPDATE_URL`, `UPDATE_AUTO` |
| `users.json`, `api-token`, `tls/` | Konta panelu, token API, certyfikat HTTPS |
| `dlna.env`, `dlna-uuid` | Ustawienia odtwarzacza DLNA |

Kopia zapasowa z panelu (System → Kopia) obejmuje cały ten katalog.

### Dane

| Katalog | Zawartość |
| --- | --- |
| `/var/lib/kiosk-photos` | Zdjęcia do pokazu slajdów |
| `/var/lib/kiosk-clips` | Nagrania z kamer po wykryciu ruchu |
| `/var/lib/kiosk-voices` | Modele głosów Piper |
| `/var/lib/kiosk-mpd` | Biblioteka i playlisty MPD |
| `/var/lib/kiosk-setup` | Pobrane aktualizacje, stan |
| `/opt/kiosk-piper` | Program Piper (TTS) |
| `/opt/kiosk-satellite` | Środowisko Pythona asystenta głosowego |

### Pliki chwilowe (znikają po restarcie)

| Plik | Rola |
| --- | --- |
| `/run/kiosk-alert.conf` | Aktywne nadpisanie ekranu: alert > zegar nocny > zdjęcia |
| `/run/kiosk-ticker.txt` | Tekst paska |
| `/run/kiosk-agenda.json` | Wydarzenia planu dnia |
| `/run/kiosk-weather.json` | Ostatnia pogoda |
| `/run/kiosk-brightness` | Bieżąca jasność |
| `/run/kiosk-netstatus.json` | Stan połączeń dla ikon na ekranie |
| `/run/kiosk-update.json` | Postęp aktualizacji dla karty na ekranie |
| `/run/kiosk-nowplaying.json`, `…-art` | Co gra i okładka dla karty „Teraz gra” |
| `/tmp/kiosk-areas` | Obszary okien wyliczone przez układ |

### Logi

- `~/.kiosk-session.log` — sesja X i układ okien
- `journalctl -u kiosk-api -f` — panel, MQTT, zapowiedzi
- `/var/log/kiosk-update.log` — aktualizacje
- `/var/log/kiosk-satellite-install.log` — instalacja asystenta głosowego

## Historia wersji kiosk-setup

Wersja 1.0.1 to pierwsze wydanie kiosk-setup, a wersja 1.0.2 dodaje dwa wyglądy zegara z oczami, a 1.0.3 — dziewięć kolejnych i mimikę oczu podczas mowy, 1.0.4 — większy słownik mimiki, 1.0.5 — wersję light, 1.0.6 — Wi-Fi w panelu i aktualizację z gita, 1.0.7 — przełączanie edycji pełna/light z panelu, 1.0.8 — lokalne rozpoznawanie twarzy, 1.0.9 — aplikację na Androida, 1.0.10 — aplikację startującą od radia, 1.0.11 — nowy układ panelu z Pilotem, 1.0.12 — ekran kiosku na żywo w panelu, 1.0.13 — szybszy podgląd ekranu (strumień wideo), 1.0.14 — aktualizacje kiosku w Home Assistant, 1.0.15 — parowanie z dodatkiem Kioski bez tokenu, 1.0.16 — odtwarzacz w telefonie i Pilot jak odtwarzacz, 1.0.17 — MAC i Wake-on-LAN (włączanie kiosków z dodatku Kioski), a 1.0.18 — automatyczną jasność wg słońca i porządek w panelu na telefonie (opisy sekcji i drugorzędne przyciski schowane, mniejsze przyciski i ikonki).

| Wersja | Data | Zawartość |
| --- | --- | --- |
| 1.0.18 | 18.10.2026 | Automatyczna jasność ekranu wg położenia słońca (sun.sun w HA albo szerokość/długość); porządek w panelu na telefonie: opisy sekcji pod „ⓘ Co to jest”, drugorzędne przyciski Pilota pod „Więcej”, mniejsze przyciski, „Na żywo”/„Odśwież” na Kamerach jako ikonki; dodatek Kioski 1.3.1 — ten sam porządek i naprawiony układ na wąskich ekranach |
| 1.0.17 | 18.10.2026 | Adres MAC, Wake-on-LAN i czas do wyłączenia w stanie kiosku (czujniki HA „Adres MAC”, „Do wyłączenia”); dodatek Kioski 1.3.0 włącza i wyłącza kioski przekaźnikiem i przez Wake-on-LAN |
| 1.0.16 | 18.10.2026 | Pilot jak odtwarzacz (okładka, ⏮ ⏯ ⏭), API graj/pauza, następna/poprzednia stacja i okładka; aplikacja Kiosk 1.5 z odtwarzaczem w powiadomieniu i na ekranie blokady |
| 1.0.15 | 18.10.2026 | „Paruj z HA”: parowanie kiosku z dodatkiem Kioski bez tokenu (okno 5 min, jedno sparowanie); dodatek Kioski 1.2.0 szuka i paruje kioski sam |
| 1.0.14 | 18.10.2026 | Aktualizacje kiosku w Home Assistant (encja „Aktualizacja”, automatyczne aktualizacje, sprawdzanie), adresy podglądu ekranu dla MJPEG IP Camera; dodatek Kioski 1.1.0; aplikacja Kiosk 1.4 z automatyczną aktualizacją |
| 1.0.13 | 18.10.2026 | Szybki podgląd ekranu na żywo (strumień MJPEG ok. 10 kl./s), VNC tylko do sterowania |
| 1.0.12 | 18.10.2026 | Ekran kiosku na żywo w panelu i aplikacji (noVNC przez WebSocket do x11vnc), podgląd albo sterowanie |
| 1.0.11 | 18.10.2026 | Nowy układ panelu: Pilot jako strona główna, zakładka Kamery, na telefonie dolne zakładki i Ustawienia jako lista; aplikacja Kiosk 1.2 otwiera się na Pilocie |
| 1.0.10 | 18.10.2026 | Aplikacja Kiosk 1.1 startuje od sterowania radiem (widok po otwarciu do wyboru); w panelu „Teraz gra” i kafelki ulubionych stacji |
| 1.0.9 | 18.10.2026 | Aplikacja Kiosk na Androida (przyciski głośności telefonu sterują kioskiem, wyszukiwanie kiosków, HTTPS z odciskiem certyfikatu); panel na telefonie: pasek pilota, większe pola dotyku, ikona na ekran główny; volume_step w API i MQTT |
| 1.0.8 | 18.10.2026 | Rozpoznawanie twarzy lokalnie na kiosku (YuNet + SFace, OpenCV): osoby ze zdjęć albo z kamery, czujniki i zdarzenie w HA, powitanie głosem, alarm i nagranie przy nieznanej osobie; update-grub i update-initramfs tylko po zmianie logo lub linii startowej |
| 1.0.7 | 18.10.2026 | Przełączanie edycji pełna/light z panelu i kiosk-update switch; poprawki aktualizacji przez panel (wgrywanie porcjami, pakiet light, adres zapisywany sam, błędy widoczne w panelu, ponowna próba po apt-get update); pasek informacyjny nie zapętla się po lewej stronie |
| 1.0.6 | 17.10.2026 | Wi-Fi w panelu (skanowanie, połączenie, DHCP/stały adres, cofnięcie bez potwierdzenia), wyłączone oszczędzanie energii Wi-Fi, wpasupplicant i iw w zależnościach; aktualizacja z GitHuba jednym przyciskiem i prosto z gita |
| 1.0.5 | 16.10.2026 | Wersja light (kiosk-setup-light): ekran, Chromium, kamery RTSP, panel WWW, MQTT/HA i muzyka, bez mowy; osobny plik aktualizacji update-light.json |
| 1.0.4 | 16.10.2026 | Większy słownik mimiki oczu (ok. 350 słów i fraz po polsku i angielsku), dopasowanie od początku słowa, wygrywa nastrój z największą liczbą trafień |
| 1.0.3 | 16.10.2026 | Nowe wyglądy zegara: oczy robota (z godziną i same), zegar słowny PL i EN, zegar radiowy LCD, kod czasu DCF77, LED z pierścieniem, minimalistyczny, woltomierze kwadratowe; oczy reagują na mowę kiosku |
| 1.0.2 | 16.10.2026 | Nowe wyglądy zegara: „Oczy z zegarem” (oczy rozglądają się, mrugają i zerkają na godzinę przy zmianie minuty) i „Same oczy” |
| 1.0.1 | 16.10.2026 | Pierwsze wydanie: ekran z kamerami RTSP, stroną HA, trybem mix i kamerą USB, wiele monitorów, pulpit + kiosk, widoki i ich rotacja; 12 wyglądów zegara, zegar nocny, zdjęcia, plan dnia, pogoda, pasek informacyjny, dymki, alert z kamerą; ikony połączeń, postęp aktualizacji i karta „Teraz gra” na ekranie; mowa (Piper, espeak), gong, radio, MPD, DLNA, interkom, asystent głosowy; harmonogram, obecność, wykrywanie ruchu z nagraniami; MQTT z auto-wykryciem w HA, API HTTP, panel WWW z kontami i HTTPS, dodatek HA „Kioski”; jasność DDC/CI lub programowa (także odwrócona); nazwa kiosku, dysk tylko do odczytu, firewall, kopia ustawień; aktualizacje z panelu, nocne i z GitHuba (update.json, SHA-256) |
