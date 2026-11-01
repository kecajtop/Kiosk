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
