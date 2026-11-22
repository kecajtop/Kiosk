## 1.5.0
- **Poprawiona trafność podglądu względem prawdziwego LVGL (pierwszy krok — pełna naprawa
  to osobny, większy projekt: prawdziwy render przez skompilowany LVGL/WebAssembly).**
  Dotychczas podgląd miał trzy duże rozjazdy z tym, jak naprawdę wygląda to na urządzeniu:
  - zwykły kontener (`obj`) bez jawnie ustawionego `bg_color` renderował się jako
    **całkowicie niewidzialny** (przezroczyste tło) — w prawdziwym LVGL (motyw domyślny)
    kontener ma nieprzezroczyste, jasne tło i jest widoczny,
  - tekst bez jawnie ustawionego `text_color` renderował się na **biało** — w motywie
    domyślnym LVGL tekst jest domyślnie ciemny; biały tekst na (dotychczas niewidzialnym,
    jasnym) tle był w praktyce nieczytelny,
  - prawie wszystkie widgety (kontenery, przyciski, paski, rozwijane listy, pola tekstowe)
    renderowały się z **ostrymi, kwadratowymi rogami** (promień 0), mimo że zaokrąglone rogi
    to jeden z charakterystycznych elementów domyślnego motywu LVGL.

  Te trzy wartości to najbardziej pewne, dobrze znane fakty o domyślnym motywie LVGL —
  dokładne liczby (promień w pikselach zależy m.in. od zadeklarowanego rozmiaru wyświetlacza
  w ESPHome) to nadal przybliżenie, nie 1:1 odwzorowanie. Pełne, dokładne „piksel w piksel”
  rozwiązanie wymaga uruchomienia prawdziwej, skompilowanej biblioteki LVGL (WebAssembly) —
  to osobny, większy projekt, zaplanowany jako kolejny krok.

## 1.4.0

- **Naprawa: pusty ekran po otwarciu dodatku.** Strona ładowała się przez Ingress Home Assistant pod
  adresem z losowym prefiksem (`/api/hassio_ingress/<token>/`), ale build Vite generował ścieżki do
  plików JS/CSS jako bezwzględne (`/assets/...`) — przeglądarka próbowała je wtedy wczytać z samego
  korzenia domeny HA, z pominięciem prefiksu Ingress, co kończyło się 404 i nigdy nie uruchamiającym się
  interfejsem. Przestawione na ścieżki względne (`base: './'` w `vite.config.ts`).
- Ten sam problem dotyczył wywołań do własnego backendu dodatku (`fetch('/api/esphome/...')`) — po
  naprawieniu ekranu te zapytania trafiałyby nie do backendu dodatku, a do API samego Home Assistant.
  Zmienione na względne (`fetch('api/esphome/...')`), tak jak ścieżki do plików statycznych.
- Usunięty martwy odnośnik do nieistniejącej ikonki `/vite.svg` (pozostałość po szablonie Vite).

## 1.3.0

- **Przycisk "Validate"** w pasku narzędzi: sprawdza na żywo, czy aktualny pulpit da się wyeksportować
  i wczytać ponownie bez strat — regeneruje YAML tak jak Export/Save, odczytuje go z powrotem i porównuje
  z tym, co jest aktualnie na ekranie, zgłaszając dokładnie który widżet/strona się rozjechała. Odświeża się
  automatycznie chwilę po każdej zmianie (zielony/żółty wskaźnik), więc nie trzeba czekać do zapisu, żeby
  zobaczyć, że coś się zepsuło.
- To samo sprawdzenie jest teraz twardą blokadą przy zapisie do pliku ESPHome (**Save**) — zapis jest
  odrzucany, jeśli bieżący stan edytora nie wczytałby się z powrotem identycznie, zamiast zapisywać
  uszkodzony plik.
- **Historia wersji** (przycisk **Versions** w pasku narzędzi): checkpointy całego pulpitu, zapisywane
  automatycznie przy otwarciu i zapisie pliku ESPHome oraz imporcie YAML/projektu, plus przycisk do
  zapisania checkpointu w każdej chwili. Przechowywane do 10 ostatnich, przetrwają odświeżenie strony
  (localStorage) — niezależnie od historii Undo/Redo (Ctrl+Z), która znika po przeładowaniu.
- Testy (`npm run fixtures:check`) rozszerzone o sprawdzenie nowego `selfTestRoundTrip`/`compareConfigsForDrift`
  na wszystkich przykładach, plus test wykrywający realny dryf (żeby sprawdzenie nie było atrapą, która
  zawsze przechodzi).

## 1.2.0

- **Ochrona przed niszczeniem plików przy zapisie:**
  - Przed każdym zapisem dodatek sam odczytuje plik z dysku i porównuje go z wersją, którą miał otwartą —
    jeśli coś zmieniło go w międzyczasie (np. własny edytor dodatku ESPHome albo edycja przez SSH), zapis
    jest przerywany z czytelnym komunikatem, zamiast nadpisać tę zmianę.
  - Zrekonstruowany YAML jest sprawdzany (poprawność składni, brak drastycznego skrócenia, obecność
    wszystkich sekcji najwyższego poziomu z oryginału) **przed** wysłaniem do zapisu — błędny wynik nigdy
    nie trafia na dysk.
  - Backend robi zapis atomowo (plik tymczasowy + zamiana, nie nadpisanie w miejscu) i przed każdym zapisem
    zachowuje kopię poprzedniej wersji pliku (`.lvgl_editor_backups/`, do 5 ostatnich wersji na plik).
  - Backend odrzuca też zapis pustej treści i nie pozwala stworzyć nowego pliku przez to API (tylko
    nadpisać istniejący, wcześniej wylistowany).
- **Znalezione i naprawione błędy utraty danych** przy imporcie/eksporcie pełnych plików ESPHome
  (wykryte testami na kilku pełnych przykładach, patrz `scripts/fixtures/` i `npm run fixtures:check`):
  - `styles:` podane jako lista (`styles: [a, b]`, poprawna składnia ESPHome) wywalało wyjątek i w efekcie
    gubiło całą zawartość strony — obsłużone teraz tak samo jak pojedynczy string czy lista rozdzielona
    spacjami.
  - Zdarzenia `on_click`, `on_value`, `on_press` i inne `on_*` były całkowicie gubione przy każdym
    imporcie/eksporcie (edytor ich po prostu nie wczytywał) — teraz przechodzą przez edytor niezmienione.
  - Tekst (`text:`) checkboksa był gubiony przy imporcie.
- Dodane testy: `npm run fixtures:check` (round-trip na kilku pełnych przykładach ESPHome+LVGL: proste
  jedno-stronicowe, wielostronicowe ze stylami/top_layer, z meter/keypad/i2c/sx1509/packages, oraz wariant
  CRLF) i `npm run backend:check` (API dodatku: listowanie, odczyt, zapis, atomowość, kopie zapasowe,
  odmowa zapisu poza folderem ESPHome, odmowa tworzenia nowych plików, wykrywanie zmiany pliku z zewnątrz).

## 1.1.0

- **Pliki ESPHome:** nowy przycisk **ESPHome Files** w pasku narzędzi — przegląda, otwiera i zapisuje pliki
  `.yaml` bezpośrednio z folderu `esphome` konfiguracji Home Assistant (mapowanie `homeassistant_config:rw`,
  ścieżka konfigurowalna opcją dodatku `esphome_path`). Otwarcie pliku ładuje go do edytora z natychmiastowym
  podglądem na płótnie; zapisuje się wyłącznie zmieniony blok `lvgl:`, reszta pliku (inne integracje,
  komentarze) zostaje nietknięta.
- Dodatek ma teraz mały, bezzależnościowy backend (Node, `server/index.js`) obsługujący tę funkcję; obraz
  Dockera nie używa już nginx, tylko samego Node do serwowania plików i API.

## 1.0.0

- Pierwsza wersja jako dodatek Home Assistant: panel otwierany z menu bocznego przez Ingress, build
  produkcyjny (Vite → statyczne pliki) serwowany przez nginx, zamiast serwera deweloperskiego Vite.
