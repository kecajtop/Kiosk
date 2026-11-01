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

Edytor działa całkowicie po stronie przeglądarki — import i eksport YAML idzie przez schowek plików
przeglądarki, dodatek nie potrzebuje dostępu do `/config`.

## Użycie w kiosku

Dodatek korzysta z Ingress, więc jest serwowany przez zalogowaną sesję Home Assistant — nie trzeba
otwierać osobnego portu. Na tablecie kioskowym wystarczy wejść na normalny adres Home Assistant i otworzyć
pozycję **Edytor LVGL** w menu bocznym.

Jeśli nie chcesz go widzieć w menu bocznym na co dzień, wyłącz **Pokaż w menu** na karcie dodatku i otwieraj
go przez **Ustawienia → Dodatki → Edytor LVGL → Otwórz interfejs WWW**.

## Aktualizacja

Nowe wersje Home Assistant pokazuje w Ustawienia → Aktualizacje (po odświeżeniu sklepu dodatków). Na karcie
dodatku można włączyć **Automatyczne aktualizacje**.
