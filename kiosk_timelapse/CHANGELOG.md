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
