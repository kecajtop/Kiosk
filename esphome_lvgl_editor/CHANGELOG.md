## 1.6.3
- **„Prawdziwy LVGL" obsługuje teraz widget `meter`** (zegary, manometry, obrotomierze —
  wszystko z tarczą i wskazówką). Zgłoszenie: podgląd dalej „nic nie pokazywał" mimo
  naprawy zawieszenia w 1.6.2 — przyczyna była inna: `meter` w ogóle nie był na liście
  obsługiwanych widgetów (`SUPPORTED_TYPES`), więc serializer po cichu go pomijał —
  strona składająca się głównie/wyłącznie z `meter` (jak w załączonym pliku urządzenia:
  `meter_page`, zegar na `clock_page`) wychodziła więc pusta, mimo że zwykły CSS-owy
  podgląd pokazywał ją poprawnie.
  - LVGL v9 usunęło stary widget `lv_meter` na rzecz `lv_scale` (ESPHome tłumaczy
    `meter:` na `lv_scale` pod spodem) — `wasm/interpreter.c` robi teraz to samo:
    `lv_scale_create` w trybie `LV_SCALE_MODE_ROUND_INNER`, zakres/kąt/obrót z pierwszej
    skali (`range_from`/`range_to`/`angle_range`/`rotation`), zwykłe i duże podziałki
    (`ticks`/`ticks.major`, ze stylami przez `LV_PART_ITEMS`/`LV_PART_INDICATOR`) i jedna
    wskazówka-linia (`lv_scale_set_line_needle_value`) z pierwszego wpisu `indicators`
    zawierającego `line`.
  - **Ograniczenie v1**: obsługiwana jest tylko PIERWSZA skala z `scales:` i co najwyżej
    JEDNA wskazówka — kolejne skale (np. osobny pierścień minut/godzin na zegarze),
    kolorowe sekcje (`tick_style`) i wskazówki typu `img`/`arc` są na razie pomijane po
    cichu, tak jak reszta nieobsługiwanych właściwości w tym pliku. Wystarcza to do
    podglądu typowej pojedynczej tarczy (manometr, zegar z jedną wskazówką), ale nie do
    pełnego odwzorowania złożonego zegara z wieloma pierścieniami na raz.
  - Zweryfikowane: `scripts/extract-scenes.ts` na załączonym pliku urządzenia (meter_page,
    clock_page) + izolowany test WASM (bez Reacta) renderujący obie sceny i porównujący
    liczbę nie-białych pikseli (dowód, że coś faktycznie się rysuje, nie pusty ekran) +
    zrzut do PNG potwierdzający wizualnie poprawną tarczę ze wskazówką i podziałkami +
    dwukrotny powtórzony render tej samej sceny (regresja do zawieszenia z 1.6.2) — bez
    błędów, każdy render < 10ms.

## 1.6.2
- **Naprawa: cała przeglądarka wisła po przełączeniu strony w „Prawdziwym LVGL"
  (nie tylko po pierwszym otwarciu, ale od DRUGIEGO renderu).** Sterownik
  wyświetlacza w `wasm/interpreter.c` miał `flush_cb` ustawione na `NULL` — LVGL
  normalnie czeka, aż sterownik potwierdzi (`lv_display_flush_ready`) skopiowanie
  klatki na ekran, zanim zacznie następne odświeżenie (na prawdziwym sprzęcie to
  przychodzi z przerwania DMA). Bez tego potwierdzenia **pierwszy** render działał
  (nic wcześniej nie czekało), ale **każdy kolejny** — czyli każda zmiana strony,
  każda edycja widgetu — wisiał w nieskończoność w `lv_refr_now()`, blokując cały
  wątek główny przeglądarki (stąd realne zawieszenie karty/okna, nie tylko
  komponentu). Naprawione przez `flush_cb`, który woła `lv_display_flush_ready()`
  natychmiast (bo tu nie ma żadnego faktycznego transferu do poczekania na niego —
  bufor czytany jest wprost z pamięci WASM).
  - Zweryfikowane end-to-end na realnym pliku urządzenia z wieloma stronami i
    widgetami (meter, buttonmatrix, spinbox, style_definitions) — dwa pełne
    przejścia po wszystkich stronach, każdy render < 1s, zero błędów; osobny test
    obciążeniowy: 200 renderów pod rząd w ~70ms bez spowolnienia czy wycieku.
- Nowy skrypt diagnostyczny `scripts/extract-scenes.ts` — zrzuca JSON „scen”
  (bez przeglądarki) dla każdej strony danego pliku YAML, do szybkiej diagnozy
  podobnych problemów w przyszłości bez klikania w całej aplikacji.

## 1.6.1
- **Naprawa: edytor wisnie/zawiesza się (biały ekran) po wczytaniu YAML, w którym
  widget ma `styles: [nazwa_stylu]` zapisane jako lista** (ESPHome dopuszcza zarówno
  `styles: nazwa`, `styles: "a b"`, jak i `styles: [a, b]` — importer zachowywał
  oryginalny kształt, ale kod renderujący podglądy (zwykły i „Prawdziwy LVGL") zakładał
  zawsze zwykły string i wołał na nim `.split(' ')`, co dla listy wyrzucało wyjątek i
  wysypywało cały interfejs (stąd wrażenie zawieszenia — aplikacja nie zamrażała się,
  tylko ubijał się komponent bez żadnego komunikatu). Naprawione przez użycie jednej,
  już istniejącej w kodzie funkcji normalizującej wszystkie trzy zapisy do tablicy,
  konsekwentnie w obu miejscach renderowania.
- Przy tej samej okazji: typ `styles` w widgetach poprawiony na `string | string[]`,
  zgodnie z tym, co faktycznie może tam wylądować po imporcie YAML.

## 1.6.0
- **Prawdziwy podgląd LVGL (krok 2 z 2 — kontynuacja 1.5.0).** Nowy przycisk w pasku
  narzędzi, **„Prawdziwy LVGL”**, pokazuje aktualną stronę wyrenderowaną przez
  **prawdziwą, skompilowaną do WebAssembly bibliotekę LVGL** (v9.1), a nie przez
  przybliżenie CSS z widoku edycji. Działa całkowicie w przeglądarce — bez instalacji
  czegokolwiek, bez przebudowy ESPHome, bez wysyłania niczego na serwer.
  - To widok tylko-do-podglądu w tej wersji: nie da się w nim jeszcze przeciągać/edytować
    widgetów — edycja zostaje w zwykłym widoku.
  - Zakres v1: obsługiwane typy — `obj, label, button, bar, slider, switch, checkbox,
    arc, led, dropdown, roller, textarea`. Jeszcze nieobsługiwane: `meter, spinner,
    image, msgbox`, pełny `buttonmatrix`, pełny `spinbox`. Widgety/właściwości spoza tej
    listy są pomijane po cichu (prawdziwy podgląd pokaże wtedy mniej niż CSS-owy) —
    pełny opis w `wasm/README.md`.
  - Dla deweloperów: `wasm/README.md` opisuje architekturę i instrukcję przebudowy
    silnika WASM.

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
