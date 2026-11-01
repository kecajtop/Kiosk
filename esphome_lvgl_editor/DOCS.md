# Edytor LVGL

Wizualny edytor pulpitów LVGL do urządzeń ESPHome, otwierany jako panel w menu bocznym Home Assistant — bez
osobnego portu czy logowania, działa też wygodnie na kiosku (tablet w trybie kiosk, Fully Kiosk Browser itp.).

## Co potrafi

- Przeciągnij-i-upuść widżety LVGL na płótno (label, button, slider, switch, arc, bar, checkbox, dropdown,
  roller i inne).
- Panel właściwości do konfiguracji wybranego widżetu (pozycja, rozmiar, kolory, tekst…).
- Dwustronna synchronizacja z widokiem kodu YAML (edytor Monaco) — zmiana w jednym widoku widać od razu
  w drugim.
- Import/eksport plików YAML zgodnych z integracją `lvgl:` ESPHome, przez standardowy wybór/zapis pliku
  w przeglądarce.
- **Pliki ESPHome** — przycisk w górnym pasku, przegląda pliki `.yaml` w folderze `esphome` konfiguracji
  Home Assistant i otwiera wybrany bezpośrednio do edycji i podglądu na żywo (patrz niżej).

## Edycja i podgląd plików ESPHome

Przycisk **ESPHome Files** w pasku narzędzi otwiera listę plików `.yaml` znalezionych w folderze `esphome`
Twojej konfiguracji Home Assistant. Pliki zawierające sekcję `lvgl:` są oznaczone zieloną plakietką **LVGL**.

1. Kliknij plik na liście — jego zawartość wczytuje się do edytora wizualnego, czyli od razu widzisz
   podgląd pulpitu LVGL (płótno renderuje widżety na żywo) i możesz go edytować jak każdy inny import.
2. Dodatek rozpoznaje pełne pliki urządzeń ESPHome (z sekcjami `esphome:`, `esp32:`, `wifi:` itd.) i edytuje
   tylko blok `lvgl:` — resztę pliku (komentarze, pozostałe integracje) zostawia bez zmian.
3. Po edycji kliknij **Save \<nazwa pliku\>** (pojawia się w pasku, gdy plik jest otwarty z dysku) — zapisuje
   zmieniony blok `lvgl:` z powrotem do tego samego pliku na dysku Home Assistant.

Dodatek czyta i zapisuje tylko pliki `.yaml`/`.yml` wewnątrz skonfigurowanego folderu (opcja dodatku
**esphome_path**, domyślnie `/homeassistant/esphome` — czyli `/config/esphome` w Home Assistant) i odrzuca
każdą próbę wyjścia poza ten folder.

Import/eksport przez przeglądarkę (przyciski **Import YAML** / **Export YAML**) działa jak dotychczas i nie
wymaga dostępu do dysku — to osobna, niezależna ścieżka od **ESPHome Files**.

## Użycie w kiosku

Dodatek korzysta z Ingress, więc jest serwowany przez zalogowaną sesję Home Assistant — nie trzeba
otwierać osobnego portu. Na tablecie kioskowym wystarczy wejść na normalny adres Home Assistant i otworzyć
pozycję **Edytor LVGL** w menu bocznym.

Jeśli nie chcesz go widzieć w menu bocznym na co dzień, wyłącz **Pokaż w menu** na karcie dodatku i otwieraj
go przez **Ustawienia → Dodatki → Edytor LVGL → Otwórz interfejs WWW**.

## Aktualizacja

Nowe wersje Home Assistant pokazuje w Ustawienia → Aktualizacje (po odświeżeniu sklepu dodatków). Na karcie
dodatku można włączyć **Automatyczne aktualizacje**.
