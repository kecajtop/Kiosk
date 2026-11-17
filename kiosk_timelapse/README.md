# Timelapse RTSP

Dodatek Home Assistant, który nagrywa poklatkowe filmy (timelapse) z dowolnych strumieni
RTSP — kamer IP, NVR-ów, albo np. strumieni z dodatku [Dashboard RTSP](../kiosk_dashboard_rtsp/README.md).

## Jak to działa

Dla każdego skonfigurowanego timelapse'u dodatek łączy się co ustalony interwał (sekundy —
od kilku do kilkudziesięciu tysięcy) ze strumieniem RTSP, łapie jedną klatkę JPEG i
zapisuje ją na dysku. O ustalonej godzinie (albo na żądanie z panelu, przyciskiem
„Renderuj teraz”) wszystkie nowe klatki od ostatniego renderu są składane `ffmpeg`-em w
jeden plik mp4. Renderowanie w całym dodatku jest **jedno na raz** i uruchamiane z niskim
priorytetem CPU (`nice`) — na obciążonym komputerze (np. gdy jednocześnie działa dużo
kiosków czy innych strumieni) render po prostu potrwa dłużej, nie zabierze CPU innym
procesom; na wolnej maszynie przebiegnie szybko. Stare klatki i stare filmy są czyszczone
automatycznie według osobnej retencji skonfigurowanej dla każdego timelapse'u.

## Instalacja

1. Dodaj repozytorium `https://github.com/kecajtop/Kiosk` w Home Assistant: Ustawienia →
   Dodatki → sklep z dodatkami → ⋮ → Repozytoria.
2. Zainstaluj dodatek **Timelapse RTSP**, uruchom.
3. Otwórz panel dodatku (ikona w menu bocznym HA).
4. Dodaj timelapse: nazwa, adres `rtsp://...` (może zawierać dane logowania), interwał
   przechwytywania, godzina automatycznego renderu, kl./s gotowego wideo oraz retencja
   klatek/filmów.
5. Gotowe filmy mp4 są widoczne w panelu (przycisk „Filmy”, pobieranie/podgląd/usuwanie) —
   a jeśli w Home Assistant jest dostępny folder `media`, trafiają też do niego (Media
   Browser HA → `timelapse_rtsp`).

Zobacz też [DOCS.md](DOCS.md).
