## 1.1.3
- Dalsza diagnostyka tego samego zgłoszenia (zapis tokenu pokazywał "0 znaków" nawet przy
  ręcznym wpisaniu paru znaków, nie tylko wklejeniu). Dodano licznik znaków liczony **na
  żywo w przeglądarce**, bez wysyłania czegokolwiek na serwer — aktualizuje się przy każdym
  wpisanym/wklejonym znaku. Pozwala sprawdzić, czy pole w ogóle rejestruje wpisywanie
  (licznik > 0 od razu po wpisaniu), zanim dojdzie do kliknięcia "Zapisz" i zapytania do
  serwera — odróżnia problem po stronie przeglądarki/klawiatury od błędu w samym zapisie.

## 1.1.2
- **Diagnostyka problemu "token się zapisał, ale dodanie dashboardu i tak zgłasza brak tokenu".**
  Najbardziej prawdopodobna przyczyna: na niektórych telefonach wklejanie do ukrytego pola
  typu "hasło" nie rejestruje się poprawnie (widać kropki, ale rzeczywista wartość pola
  zostaje pusta albo obcięta). Dodano przycisk 👁 przy polu tokenu, żeby zobaczyć wklejoną
  wartość przed zapisem, oraz liczbę zapisanych znaków w potwierdzeniu "✓ Zapisano" (token
  HA ma zwykle grubo ponad 100 znaków — jeśli licznik pokazuje kilka/kilkanaście, wklejanie
  się nie powiodło). Backend dodatkowo przycina białe znaki (`strip()`) i loguje długość
  zapisanego tokenu (nie treść) przy każdym zapisie ustawień.

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
