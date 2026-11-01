# Dashboard RTSP — dokumentacja

## Co to robi

Streamuje dowolny dashboard/widok Home Assistant jako zwykłą kamerę RTSP — przydatne gdy
chcesz pokazać np. widok „Dom” albo tablicę z czujnikami tam, gdzie zwykle podłącza się
kamerę: w NVR-ze, na kiosku RTSP (`kiosk-setup`, tryb `rtsp`/`mix`), na monitorze
podłączonym przez dekoder RTSP, itd. — bez konieczności trzymania osobnego ekranu
zalogowanego do HA.

## Konfiguracja

**Adres Home Assistant** — wewnątrz sieci dodatków HA zwykle wystarczy
`http://homeassistant:8123` (wewnętrzna nazwa, zawsze działa niezależnie od adresu IP
instancji). Można też podać pełny adres zewnętrzny, jeśli z jakiegoś powodu dodatek miałby
łączyć się inaczej.

**Token** — zwykły długoterminowy token dostępu Home Assistant (profil użytkownika →
Zabezpieczenia → „Utwórz token długoterminowy”). Jeden token działa dla wszystkich
dashboardów. Dodatek wstrzykuje go do przeglądarki przez małe rozszerzenie Chromium
działające tylko lokalnie (nie jest nigdzie wysyłany poza żądania do Twojego HA) — dzięki
temu każdy dashboard otwiera się od razu zalogowany, bez ekranu logowania.

**Dashboard** — `Ścieżka w HA` to część adresu po `/` dashboardu/widoku w Lovelace, np.
dla `http://homeassistant:8123/lovelace-salon/0` wpisujesz `/lovelace-salon/0`.
Rozdzielczość i liczba klatek na sekundę wpływają na obciążenie CPU — dashboard (statyczne
UI, odświeżające się raz na jakiś czas) nie potrzebuje więcej niż 4–8 kl./s; wyżej ma sens
tylko dla widoków z animacją/wideo.

## Strumień

Każdy dashboard dostaje osobną ścieżkę pod wspólnym portem RTSP (domyślnie 8554):

```
rtsp://<adres-HA-lub-IP>:8554/<id-dashboardu>
```

`<id-dashboardu>` to krótki losowy identyfikator widoczny w panelu obok nazwy strumienia.
Sam port trzeba otworzyć/przekierować tak samo jak każdy inny port dodatku HA — w panelu
dodatku widać go jako „8554/tcp”.

## Diagnostyka

Przy każdym strumieniu w panelu jest przycisk **Log** — pokazuje ostatnie zdarzenia (start,
restart, błędy Xvfb/Chromium/ffmpeg) tego konkretnego dashboardu. Każdy strumień ma własny
wątek nadzorujący: jeśli którykolwiek z trzech procesów (Xvfb, Chromium, ffmpeg) padnie,
cała trójka wraca automatycznie po kilku sekundach (rosnący odstęp między próbami, do 30 s),
bez potrzeby ręcznej interwencji.

**Strumień się nie łączy / czarny ekran:**
- Sprawdź, czy token jest ustawiony (Ustawienia → pole token puste = ustawiony, bo nie jest
  nigdy pokazywany ponownie ze względów bezpieczeństwa).
- Sprawdź log konkretnego dashboardu — najczęstsza przyczyna to zła ścieżka (literówka w
  adresie dashboardu) albo zbyt mało pamięci/CPU na jednoczesne trzymanie kilku ciężkich
  dashboardów naraz.
- Port 8554 musi być osiągalny z urządzenia, które próbuje się połączyć (ten sam port dla
  wszystkich strumieni, różne ścieżki).

## Ograniczenia

- To nie jest „prawdziwa” integracja z silnikiem renderującym HA — po prostu działająca w
  tle przeglądarka, więc każdy dashboard zużywa realne zasoby CPU/RAM (osobny proces
  Chromium + Xvfb + ffmpeg na strumień). Kilka–kilkanaście strumieni jednocześnie na
  skromnym sprzęcie (np. Raspberry Pi) może być za dużo — testuj stopniowo.
- Wstrzykiwanie tokenu przez rozszerzenie Chromium zależy od wewnętrznego mechanizmu
  logowania frontendu Home Assistant (`localStorage.hassTokens`); jeśli po dużej
  aktualizacji HA logowanie przestanie działać, to tutaj jest miejsce, które mogło się
  rozjechać.
