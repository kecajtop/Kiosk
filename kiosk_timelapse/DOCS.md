# Timelapse RTSP — dokumentacja

## Co to robi

Nagrywa poklatkowe filmy (timelapse) z dowolnych strumieni RTSP — kamer IP, NVR-ów, albo
strumieni z dodatku Dashboard RTSP. Przydatne np. do obserwacji wzrostu rośliny, budowy,
zachodu słońca, placu budowy itp. — bez trzymania całego nagrania w rozdzielczości i
klatkarzu kamery.

## Konfiguracja każdego timelapse'u

**Adres RTSP** — pełny adres `rtsp://...`, może zawierać dane logowania
(`rtsp://user:pass@host:554/stream1`). Dane logowania nigdy nie są pokazywane w panelu
(adres wyświetlany na liście jest maskowany) ani zapisywane w logu błędów.

**Transport** — TCP (domyślnie, zalecany — odporniejszy na NAT/firewalle i utratę
pakietów) albo UDP.

**Interwał** — co ile sekund dodatek łapie jedną klatkę. Krótkie, osobne połączenie na
każdą klatkę (strumień nie jest trzymany otwarty cały czas) — proste i odporne na typowe
rozłączenia RTSP między kolejnymi przechwyceniami.

**Render o (HH:MM)** — godzina, o której dodatek automatycznie składa wszystkie nowe
klatki (od ostatniego renderu, niezależnie czy był automatyczny czy ręczny) w jeden plik
mp4. Przycisk „Renderuj teraz” w panelu robi to samo od ręki, w każdej chwili.

**kl./s wideo** — tempo odtwarzania gotowego filmu (np. 24 = każda klatka pojawia się na
1/24 s). Nie ma żadnego związku z interwałem przechwytywania — to on decyduje, ile
rzeczywistego czasu reprezentuje jedna klatka wideo.

**Retencja klatek / wideo (dni)** — surowe klatki JPEG (duże, ważne tylko do złożenia w
wideo) są czyszczone po skonfigurowanej liczbie dni; gotowe pliki mp4 (dużo mniejsze) mają
własną, zwykle znacznie dłuższą retencję (`0` = bez limitu, nigdy nie czyszczone
automatycznie).

## Renderowanie i obciążenie komputera

W całym dodatku renderuje się tylko jeden film na raz, niezależnie od tego, ile
timelapse'ów jest skonfigurowanych — kolejne żądania renderu (z harmonogramu albo
ręczne) czekają w kolejce. Sam proces `ffmpeg` renderujący wideo jest odpalany przez
`nice` z niskim priorytetem CPU: jądro Linuksa oddaje mu procesor tylko wtedy, gdy inne
procesy go nie potrzebują — więc na zajętej maszynie (np. gdy jednocześnie działają inne
dodatki czy kioski) render naturalnie zwolni, a na wolnej przebiegnie z pełną prędkością,
bez sztywnego, zgadywanego limitu.

## Pliki wideo

Gotowe filmy mp4 są widoczne w panelu pod przyciskiem „Filmy” przy każdym timelapse —
można je odtworzyć w nowej karcie, pobrać albo usunąć ręcznie. Jeśli dodatkowi
zamapowany jest folder `media` Home Assistant (domyślnie tak, `map: media:rw`), każdy
wyrenderowany film trafia też do `media/timelapse_rtsp/<id>/` i jest widoczny w
Media Browser HA.

## Testowanie i diagnostyka

Przycisk „Testuj teraz” wymusza natychmiastowe przechwycenie jednej klatki (działa też,
gdy timelapse jest akurat wstrzymany) — przydatne do szybkiej weryfikacji, czy adres RTSP
i dane logowania są poprawne, bez czekania na najbliższy interwał. Przycisk „Log” pokazuje
ostatnie zdarzenia (błędy połączenia RTSP, przebieg renderowania) dla danego timelapse'u.
