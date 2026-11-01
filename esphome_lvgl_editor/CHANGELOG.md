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
