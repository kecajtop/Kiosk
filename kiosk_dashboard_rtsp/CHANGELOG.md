## 1.1.1
- **Naprawa: panel nie pokazywał żadnego potwierdzenia po zapisaniu tokenu HA.** Literówka w
  JS wpisywała informację „token ustawiony” w pole adresu HA, a nie w pole tokenu — to pole
  samo nigdy nie zmieniało wyglądu, więc kliknięcie „Zapisz” wyglądało jak nic nie robiące.
  Teraz: pole tokenu po zapisaniu pokazuje jako placeholder „(token ustawiony ✓)”, a przy
  samym przycisku „Zapisz” pojawia się na chwilę „✓ Zapisano”.

## 1.1.0
- **Naprawa: strumień zawieszał się na statusie "błąd" / czarnym ekranie bez auto-restartu.**
  Jeśli padał Xvfb albo Chromium, a ffmpeg (celowo cichy, `-loglevel error`) jeszcze żył, wątek
  nadzorujący próbował odczytać jego stderr — ale skoro ffmpeg nic nie napisał i nie zamknął
  potoku, odczyt blokował się **na zawsze**, zamrażając nadzór nad tym strumieniem (żadnego
  restartu, status zastyga). Naprawione: wszystkie procesy są teraz zabijane *przed* próbą
  odczytu stderr, a log pokazuje, który konkretny proces padł (Xvfb/Chromium/ffmpeg).
- Zabezpieczenie przed "zombie" gniazdem X11: jeśli poprzedni Xvfb na tym samym displayu nie
  zamknął się czysto, jego stare gniazdo/lock (`/tmp/.X11-unix/X<n>`, `/tmp/.X<n>-lock`) mogło
  oszukać sprawdzanie gotowości nowego Xvfb (widziane jako "gotowe" od razu, mimo że nowy
  proces mógł faktycznie nie wystartować) — teraz usuwane przed każdym startem.
- Status strumienia poprawnie pokazuje teraz "błąd — próbuję ponownie" w chwili wykrycia
  padniętego procesu, a nie tylko po przejściu przez wyjątek.

## 1.0.0
- Pierwsze wydanie: dowolny dashboard/widok Home Assistant jako kamera RTSP. Xvfb + Chromium
  (bezobsługowe logowanie przez wstrzyknięty długoterminowy token) + ffmpeg (x11grab) +
  wbudowany serwer RTSP (MediaMTX), jeden port, osobna ścieżka na dashboard. Panel do
  zarządzania strumieniami (dodaj/usuń/restart/log) przez Ingress.
