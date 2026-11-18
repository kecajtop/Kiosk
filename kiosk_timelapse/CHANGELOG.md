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
