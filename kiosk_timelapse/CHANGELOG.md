## 1.2.5
- **Lista kamer z Home Assistanta przy dodawaniu timelapse'u**, zamiast ręcznego
  wpisywania wszystkiego od zera. Nowy rozwijany wybór „Kamera z Home Assistanta" w
  formularzu „Nowy timelapse" - wybranie kamery wypełnia pola Nazwa/Adres RTSP, jeśli
  Home Assistant trzyma go jawnym tekstem w swoim configu.
  - Wymaga nowego uprawnienia **tylko do odczytu** do folderu `/config` Home Assistanta
    (`map: config:ro`) - tak jak przy `homeassistant_api`, zadziała dopiero po **pełnej
    reinstalacji** dodatku, nie po samym restarcie.
  - Dwa źródła: kamery dodane przez UI (`/config/.storage/core.config_entries`,
    integracje `generic`/`ffmpeg`) i kamery skonfigurowane ręcznie w plikach YAML pod
    `/config` (proste skanowanie bloków `- platform: generic/ffmpeg`, celowo NIE pełny
    parser YAML - dodatek nie ma biblioteki do tego w obrazie, a HA i tak używa
    własnych tagów `!include`/`!secret`).
  - **Nigdy nie otwiera `secrets.yaml`.** Kamera, której adres w configu jest podany
    przez `!secret` (albo pochodzi z integracji bez jawnego adresu, np. ONVIF), trafia
    na listę z samą nazwą - adres trzeba i tak wpisać ręcznie, zamiast cokolwiek po
    cichu podstawiać.
  - Zweryfikowane lokalnie na przykładowym `/config` (core.config_entries + YAML z
    kamerą jawną, kamerą przez `!secret` i kamerą ONVIF) - w wyniku: jawne adresy
    wyciągnięte poprawnie, `!secret` poprawnie pominięty (bez czytania `secrets.yaml`),
    ONVIF poprawnie pominięta.

## 1.2.4
- **Konfiguracja (lista timelapse'ów i ustawień) przeżywa teraz odinstalowanie/reinstalację
  dodatku.** Zgłoszenie: po radzie "odinstaluj i zainstaluj ponownie" (żeby wymusić
  nadanie uprawnienia `homeassistant_api`) użytkownik słusznie zauważył, że `/data` to
  prywatny folder TEGO dodatku, który Supervisor kasuje razem z nim przy odinstalowaniu -
  czyli cała konfiguracja (adresy RTSP, godziny, retencja) przepadłaby.
  - Każdy zapis `config.json` jest teraz (best-effort, nie blokuje normalnego zapisu)
    kopiowany też do `/share/timelapse_rtsp/config_backup.json` - `/share` jest
    współdzielone między wszystkimi dodatkami i samym Home Assistantem, więc przeżywa
    odinstalowanie/reinstalację tego konkretnego dodatku.
  - Jeśli po starcie `/data/config.json` wygląda na pusty/świeży (brak timelapse'ów), a
    kopia w `/share` istnieje i ma jakieś timelapse'y, dodatek **automatycznie** ją
    przywraca - bez żadnej akcji ze strony użytkownika. W logu pojawia się wtedy jasna
    informacja, że tak się stało (ile timelapse'ów przywrócono).
  - Zweryfikowane lokalnie: zapis configu z jednym timelapse'em, ręczne skasowanie całego
    folderu `/data` (symulacja tego, co robi Supervisor przy odinstalowaniu), kolejne
    wczytanie configu - timelapse wraca automatycznie, `/data/config.json` odtworzony.

## 1.2.3
- **Naprawa: log dodatku zaśmiecony pełnym tracebackiem `ConnectionResetError`/
  `BrokenPipeError` za każdym razem, gdy przeglądarka albo proxy Ingress HA po prostu
  zamkną połączenie w trakcie żądania** (np. ktoś zamknął kartę albo odświeżył panel w
  złym momencie) - zupełnie normalne zdarzenie, nie błąd dodatku, ale wyglądało groźnie
  w logu i utrudniało znalezienie prawdziwych problemów (np. przy diagnozowaniu okna
  dzień/noc z 1.2.1). Te dwa konkretne wyjątki są teraz wyciszane; każdy inny błąd
  nadal dostaje pełny traceback jak wcześniej.

## 1.2.2
- **Scalanie wszystkich gotowych filmów jednego timelapse'u w jeden plik.** Przycisk „Scal
  wszystkie w jeden plik” w panelu „Filmy” (widoczny, gdy są co najmniej 2 pliki) - łączy je
  w kolejności nagrania (ffmpeg, demuxer `concat`). Najpierw próbuje szybkiego, bezstratnego
  łączenia bez ponownego kodowania („stream copy” - wszystkie pliki normalnie mają ten sam
  kodek, bo powstały z tego samego renderu), a jeśli się nie uda (np. pliki z różnych wersji
  dodatku/konfiguracji), automatycznie próbuje ponownie z pełnym przekodowaniem. Działa w
  tle (może potrwać dla dużej liczby/dużych plików) i dzieli tę samą kolejkę/priorytet CPU
  (`nice`) co zwykłe renderowanie, żeby nie odpalić dwóch ciężkich ffmpegów naraz. Scalony
  plik pojawia się na liście jak zwykły render (też kopiowany do Media Browser HA, jeśli
  `/media` jest zamapowane) - oryginalne, niescalanie pliki zostają bez zmian (możesz je
  potem ręcznie usunąć, jeśli nie są już potrzebne).

## 1.2.1
- **Widoczne ostrzeżenie, gdy okno przechwytywania „dzień”/„noc” nie działa.** Zgłoszenie:
  mimo wybranego okna „dzień (wschód→zachód)”, timelapse łapał klatki także w nocy. Przyczyna:
  gdy dodatek nie może odczytać stanu słońca z Home Assistant (np. brak SUPERVISOR_TOKEN po
  aktualizacji bez restartu dodatku, albo chwilowy brak łączności z API HA), `in_capture_window`
  *celowo* nie blokuje przechwytywania („lepiej złapać klatkę na wszelki wypadek niż przegapić
  całe okno") — ale dotąd jedyny ślad tego zostawał w logu dodatku, którego nikt rutynowo nie
  czyta, więc wyglądało to jak zwykły bug, a nie utrata łączności z API HA. Teraz: jeśli
  jakikolwiek timelapse ma ustawione okno „dzień”/„noc”, a odczyt stanu słońca nie działa, w
  panelu pojawia się czerwony baner z dokładnym powodem (ten sam wzór co istniejące
  ostrzeżenie o małej ilości miejsca na dysku).

## 1.2.0
- **Wykrywanie osób przez zewnętrzny serwer [DOODS](https://github.com/snowzach/doods).**
  Dodatek nie uruchamia ani nie konfiguruje samego DOODS — tylko wysyła do niego już
  skonfigurowanego serwera każdą zwykłą, zaplanowaną klatkę i pyta, czy jest na niej osoba.
  Jeśli tak, natychmiast łapie jedną dodatkową klatkę poza normalnym interwałem (nie
  częściej niż raz na 20 s na timelapse, żeby osoba stojąca dłużej w kadrze nie zasypała
  klatek niemal identycznymi ujęciami). Konfiguracja globalna (adres DOODS, detektor,
  opcjonalny klucz autoryzacji, próg pewności) w nowej sekcji „Ustawienia” w panelu;
  włączenie per-timelapse osobnym polem w formularzu dodawania/edycji. Brak odpowiedzi z
  DOODS, błąd połączenia albo brak skonfigurowanego adresu nigdy nie przerywa ani nie
  spowalnia zwykłego przechwytywania klatek — to czysty dodatek, nie zależność.

## 1.1.4
- **Naprawa: czasem znikał cały skonfigurowany timelapse z panelu** (pojawiał się komunikat
  „Brak timelapse'ów — dodaj pierwszy powyżej”, mimo że był wcześniej dodany) — po chwili
  zwykle wracał sam. Przyczyna: `config.json` nie był w żaden sposób chroniony przed
  jednoczesnym zapisem z dwóch wątków naraz — każde żądanie panelu (dodanie/edycja/
  usunięcie/zmiana ustawień) obsługiwane jest przez osobny wątek, a do tego dochodzi wątek
  renderujący, który też dopisuje datę ostatniego renderu. Dwa takie zapisy trafiające się
  w tym samym momencie pisały do tego samego pliku tymczasowego i potrafiły się nawzajem
  popsuć w trakcie zapisu, zostawiając w `config.json` uszkodzony/obcięty JSON. Odczyt
  takiego pliku kończył się wyjątkiem, który po cichu był łapany i zamieniany na pustą
  konfigurację — stąd wrażenie, że timelapse „znika znikąd”, a po kolejnym poprawnym
  zapisie (np. edycji czegoś) wracał. Naprawione: wszystkie miejsca zapisujące
  `config.json` są teraz zsynchronizowane jedną blokadą, a dodatkowo każdy zapis używa
  osobnego pliku tymczasowego (druga, niezależna warstwa zabezpieczenia).

## 1.1.3
- **Naprawa: przechwytywanie klatki kończyło się „Error initializing the muxer... Invalid
  argument” po tym, jak ffmpeg w ogóle zdołał się połączyć ze strumieniem RTSP.** Plik
  tymczasowy, do którego ffmpeg zapisuje klatkę, kończył się na `.jpg.tmp` — a ffmpeg bez
  wprost podanego formatu zgaduje go z rozszerzenia pliku, więc `.tmp` (nieznane mu
  rozszerzenie) powodowało ten błąd. Wcześniej był on niewidoczny, bo w typowych
  zgłoszeniach ffmpeg nie docierał nawet tak daleko (padał już na samym połączeniu RTSP —
  „Host is unreachable” itp.) — dopiero po naprawieniu dostępu do sieci (1.1.0/1.1.2) ten
  drugi, zasłonięty błąd się odkrył. Naprawione: format wyjścia jest teraz podawany wprost
  (`-f mjpeg`), niezależnie od rozszerzenia pliku tymczasowego.
- **Naprawa: odświeżanie podglądu listy przerywało edycję na telefonie, mimo że ochrona w
  JS (`editingIds`) wyglądała poprawnie i w ogóle nie wykonywała żadnego odświeżania w
  trakcie edycji.** Prawdziwa przyczyna: natywny gest przeglądarki mobilnej „przeciągnij,
  żeby odświeżyć” — przewinięcie do samego początku strony i pociągnięcie w dół powoduje
  PRAWDZIWE przeładowanie całej strony przez przeglądarkę, co nie ma nic wspólnego z
  własnym odświeżaniem co 5 s w JS i nie dało się tego naprawić żadną poprawką samego JS.
  Naprawione przez `overscroll-behavior: contain` w CSS, które wyłącza ten gest.

## 1.1.2
- **Port panelu zmieniony z 8097 na 18097.** Retry z 1.1.1 nie pomaga, gdy port jest zajęty
  trwale, nie tylko na chwilę po restarcie — zgłoszenie użytkownika pokazało właśnie taki
  przypadek (10 prób przez ~20 s i dalej „Address in use”). `host_network: true` (1.1.0)
  oznacza, że port panelu jest teraz prawdziwym portem na całym komputerze, więc może
  kolidować z dosłownie czymkolwiek innym na tej maszynie, nie tylko z innym dodatkiem
  tego repo — co w domyślnej, odizolowanej sieci kontenera było fizycznie niemożliwe.
  18097 to nietypowy numer, więc mniej prawdopodobna przypadkowa kolizja.
- Jeśli port i tak jest trwale zajęty, dodatek po wyczerpaniu prób pisze w logu wprost, że
  to nie chwilowy wyścig przy restarcie, i podaje komendę (`ss -tlnp | grep <port>`) do
  sprawdzenia przez dodatek Terminal/SSH, co dokładnie go zajmuje — zamiast kończyć się
  samym surowym tracebackiem.

## 1.1.1
- **Naprawa: dodatek nie startował po restarcie/aktualizacji — `OSError: [Errno 98]
  Address in use`, cały proces się wywalał.** Efekt domku z kart po `host_network: true`
  z 1.1.0: port panelu jest teraz prawdziwym gniazdem na hoście (wcześniej każdy
  restart dostawał świeżą, odizolowaną sieć kontenera, więc kolizja portu była
  niemożliwa) — przy restarcie bywa krótka chwila, w której poprzedni proces dodatku
  jeszcze nie zwolnił portu, a nowy już próbuje się na niego zbindować. Dodatek teraz w
  takiej sytuacji czeka i próbuje ponownie (do ~20 s), zamiast od razu się wywalać.

## 1.1.0
- **Naprawa: przechwytywanie klatek kończyło się „Host is unreachable” dla kamer w sieci
  LAN.** Domyślna, izolowana sieć Dockera dodatków (bridge) nie ma trasy do zwykłych
  urządzeń w sieci użytkownika (np. kamer IP) — ffmpeg nie mógł nawet nawiązać połączenia,
  niezależnie od poprawności adresu/danych logowania. Dodatek teraz działa w sieci hosta
  (`host_network: true`, config.yaml) — ma taki sam dostęp do sieci LAN jak sam Home
  Assistant. Panel (Ingress) i tak odrzuca połączenia spoza Supervisora/loopbacku, więc to
  nie otwiera panelu na całą sieć.
- **Okno przechwytywania** — można teraz ograniczyć łapanie klatek do wybranych godzin:
  „zakres godzin” (dowolny przedział, może przechodzić przez północ, np. 20:00–06:00) albo
  „noc”/„dzień” liczone z rzeczywistego wschodu/zachodu słońca dla lokalizacji skonfigurowanej
  w Home Assistant (encja `sun.sun`, odczytywana przez Supervisora — bez potrzeby podawania
  współrzędnych). Przycisk „Testuj teraz” zawsze łapie klatkę natychmiast, niezależnie od
  okna i pauzy — to świadome wyjątki, do szybkiej diagnostyki.
- **Wybór miejsca składowania klatek i filmów** — domyślnie `/data` (w obrębie dodatku), ale
  można przełączyć na `/media/timelapse_rtsp_storage`, `/share/timelapse_rtsp` albo własną
  ścieżkę (zapisana ścieżka jest od razu sprawdzana próbnym zapisem). Sama konfiguracja
  dodatku zawsze zostaje w `/data`, niezależnie od tego ustawienia — inaczej zmiana na
  niedostępną ścieżkę zablokowałaby odczyt samej konfiguracji. Zmiana dotyczy nowych
  klatek/renderów; istniejące pliki trzeba przenieść ręcznie.
- **Powiadomienie o małej ilości wolnego miejsca** (poniżej 5%) — czerwony baner w panelu
  oraz prawdziwe powiadomienie Home Assistant (`persistent_notification`), widoczne nawet
  bez otwartego panelu dodatku; samo się chowa/kasuje, gdy miejsca znowu przybędzie.

## 1.0.0
- Pierwsze wydanie: nagrywanie poklatkowych filmów (timelapse) z dowolnych strumieni RTSP.
  Dla każdego skonfigurowanego timelapse'u dodatek łapie jedną klatkę JPEG co ustalony
  interwał (osobne, krótkie połączenie RTSP na klatkę), a o ustalonej godzinie (albo na
  żądanie, przyciskiem „Renderuj teraz”) składa wszystkie nowe klatki od ostatniego
  renderu w jeden plik mp4 (`ffmpeg`, demuxer `concat`).
- **Renderowanie zależne od obciążenia komputera**: w całym dodatku tylko jeden render na
  raz (kolejne żądania czekają w kolejce), a sam proces `ffmpeg` renderujący wideo jest
  odpalany przez `nice` z niskim priorytetem CPU — na zajętej maszynie render naturalnie
  zwolni (jądro oddaje CPU innym procesom), na wolnej przebiegnie z pełną prędkością, bez
  sztywnego, zgadywanego limitu.
- Osobna, konfigurowalna per-timelapse retencja: surowych klatek JPEG (dni) i gotowych
  plików mp4 (dni, `0` = bez limitu) — czyszczenie w tle co 10 minut.
- Panel (Ingress): dodawanie/edycja/usuwanie timelapse'ów, pauza/wznowienie, podgląd
  ostatniej złapanej klatki, log zdarzeń, wymuszenie przechwycenia klatki lub renderu od
  ręki, lista/pobieranie/odtwarzanie/usuwanie gotowych filmów mp4 (z obsługą zakresów
  bajtów `Range`, więc przewijanie podglądu działa bez pobierania całego pliku).
- Gotowe filmy kopiowane też do `media/timelapse_rtsp/<id>/` (jeśli folder `media` jest
  zamapowany) — widoczne w Media Browser Home Assistant, niezależnie od panelu dodatku.
- Adres RTSP może zawierać dane logowania — nigdy nie są one pokazywane w panelu (adres na
  liście jest maskowany) ani zapisywane w logu błędów.
- Edycja formularza chroniona przed cyklicznym odświeżaniem panelu (co 5 s) tym samym,
  już sprawdzonym sposobem co w dodatku Dashboard RTSP: dopóki jakikolwiek formularz
  edycji jest otwarty, odświeżanie w ogóle się nie wykonuje.
