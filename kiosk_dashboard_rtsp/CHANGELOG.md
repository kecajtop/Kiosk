## 1.3.1
- **Naprawa: edycja dalej była przerywana przez odświeżanie co ~5 s.** Poprzednia poprawka
  (1.3.0) chroniła tylko wartości pól formularza, ale samo przeładowanie miniaturki podglądu
  w edytowanym wierszu potrafiło na telefonie zabrać fokus z pola, w którym ktoś akurat
  pisał. Teraz, dopóki formularz edycji danego strumienia jest otwarty, ten wiersz (razem z
  obrazkiem podglądu) jest całkowicie pomijany przy odświeżaniu — pozostałe wiersze nadal
  się odświeżają normalnie.
- **Link MJPG obok linku RTSP** przy każdym strumieniu, z własnym przyciskiem „Kopiuj MJPG”
  (adres portu 8099 z 1.3.0, wcześniej dodanego bez widocznego linku w panelu).

## 1.3.0
- **Automatyczne ukrywanie paska bocznego HA** w strumieniu — dodatek zapisuje też
  `localStorage.dockedSidebar = "always_hidden"` (oficjalny klucz ustawienia profilu
  użytkownika na "zawsze ukryty"), więc dashboard w strumieniu wypełnia cały ekran bez
  menu nawigacji.
- **Ułamkowe kl./s** — można teraz podać wartość poniżej 1, np. `0.2` (1 klatka na 5 s) albo
  `0.05` (1 klatka na 20 s). Dla dashboardu, który rzadko się zmienia, to spora oszczędność
  CPU względem sztywnego minimum 1 kl./s. Dotyczy zarówno nowych dashboardów, jak i edycji
  istniejących.
- **Opcjonalny podgląd JPG/MJPEG bez logowania**, równolegle do RTSP, na nowym porcie 8099
  (ten sam model zaufania co RTSP — bez auth, do sieci lokalnej): `GET /snapshot/<id>.jpg`
  (pojedyncza klatka) i `GET /mjpeg/<id>` (ciągły strumień `multipart/x-mixed-replace`,
  wygodny dla integracji "Kamera generyczna" w HA, starszych NVR-ów czy podglądu wprost w
  przeglądarce bez RTSP).
- **Naprawa: odświeżanie podglądu (co ~5 s) niszczyło i odtwarzało cały wiersz strumienia**,
  łącznie z otwartym formularzem edycji i możliwością zaznaczenia/skopiowania linku RTSP —
  w trakcie pisania pola potrafiły "wracać" do starej wartości, a zaznaczenie tekstu się
  gubiło. Przepisane tak, że każdy wiersz (i formularz edycji) jest tworzony raz; cykliczne
  odświeżanie tylko podmienia obraz podglądu i status w miejscu, nigdy nie dotykając pól,
  które ktoś akurat edytuje albo zaznacza.

## 1.2.2
- **Prawdziwa przyczyna "w podglądzie widać ekran logowania HA" znaleziona i naprawiona.**
  Dzięki podglądowi obrazu (1.2.0) i logom Chromium (1.2.0) z 1.2.1 było już widać, że
  strona faktycznie się ładuje — tylko jako ekran logowania, nie dashboard. Zweryfikowane
  względem źródeł `home-assistant-js-websocket`: zapisany w `localStorage.hassTokens` obiekt
  jest akceptowany TYLKO, gdy jego pole `hassUrl` (dokładnie taka pisownia, camelCase) jest
  równe żądanemu adresowi — nasz kod zapisywał `hass_url` (podkreślenie), więc frontend HA
  po cichu ignorował token (bez żadnego błędu w konsoli) i przechodził do prawdziwego
  logowania. Naprawione: poprawny klucz `hassUrl`, dodane wymagane `refresh_token` (pusty
  string dla tokenu długoterminowego) i `expires` (bezwzględny czas wygaśnięcia, liczony w
  przeglądarce w momencie wstrzyknięcia). Zweryfikowane lokalnym testem jednostkowym
  kształtu generowanego obiektu.
- Log Chromium nie jest już zalewany nieszkodliwym szumem D-Bus/UPower (normalnym w
  kontenerze bez systemowego D-Busa) — zasłaniał realne błędy.

## 1.2.1
- **Naprawa: edycja strumienia "gryzła się" z automatycznym odświeżaniem** — panel
  odświeża listę co 5 s, co niszczyło i odtwarzało formularz edycji ze starymi wartościami
  z konfiguracji, kasując na bieżąco to, co ktoś akurat wpisywał (pole "wracało" do
  poprzedniej wartości w trakcie pisania). Dopóki formularz edycji jakiegokolwiek strumienia
  jest otwarty, panel przestaje przerysowywać listę strumieni (reszta nadal się odświeża).

## 1.2.0
- **Edycja istniejących strumieni** — przycisk „Edytuj" przy każdym strumieniu pozwala
  zmienić nazwę, ścieżkę w HA, rozdzielczość i kl./s bez usuwania i dodawania od nowa
  (zmiana parametrów automatycznie restartuje tylko ten jeden strumień).
- **Prawdziwy, klikalny link RTSP z przyciskiem „Kopiuj link"** — zamiast placeholdera
  `<adres-HA>` panel generuje teraz rzeczywisty adres (na podstawie adresu, pod którym
  sam jest otwierany) gotowy do wklejenia w VLC czy innym odtwarzaczu RTSP.
- **Podgląd obrazu wprost w panelu** — przy każdym strumieniu miniaturka (odświeżana co
  ok. 5 s) z tego samego ekranu X11, który koduje ffmpeg — widać od razu, czy dashboard
  się faktycznie renderuje, bez potrzeby zewnętrznego odtwarzacza RTSP. Gdy podgląd
  niedostępny (strumień nie działa), pokazuje się czytelny placeholder zamiast zepsutej
  ikony obrazka.
- **Log strumienia pokazuje teraz też błędy Chromium**, nie tylko ffmpeg. Wcześniej, gdy
  strona się nie wczytała poprawnie (zły token, zła ścieżka, błąd JS) i wyszedł np. biały
  ekran z kursorem, Chromium nie "padał" jako proces, więc Log nic nie pokazywał — teraz
  jego stderr (błędy JS/sieci/nawigacji) trafia do tego samego Logu co błędy ffmpeg.

## 1.1.5
- **Naprawa: ffmpeg nie mógł opublikować strumienia do MediaMTX — "Could not write header
  (incorrect codec parameters ?): Server returned 400 Bad Request", w kółko restart co kilka
  sekund.** Nasz `mediamtx.yml` całkowicie zastępuje domyślną konfigurację MediaMTX (nie jest
  z nią scalany), a domyślny wpis `paths: all_others:` — który zezwala na publikowanie
  dowolnej nowej nazwy ścieżki (tu: jednej na dashboard) — był w nim pominięty. Bez niego
  MediaMTX odrzucał (`400`) żądanie ANNOUNCE ffmpeg dla każdej nieznanej ścieżki. Dodano
  jawnie `paths: all_others:` do naszej konfiguracji, zgodnie z oficjalnym domyślnym plikiem
  MediaMTX.

## 1.1.4
- **Prawdziwa przyczyna "zapis tokenu zwraca 0 znaków" znaleziona i naprawiona.** Licznik
  znaków dodany w 1.1.3 potwierdził, że przeglądarka poprawnie wysyła token (183 znaki), ale
  serwer i tak zapisywał pusty łańcuch. Powód: żądania POST przechodzące przez proxy Ingress
  Home Assistant (zwłaszcza z `ingress_stream: true`) przychodzą do dodatku bez nagłówka
  `Content-Length`, tylko z `Transfer-Encoding: chunked` — kod czytający body polegał
  wyłącznie na `Content-Length`, więc przy jego braku po prostu pomijał treść żądania jako
  pustą. Dodano ręczne dekodowanie `chunked` (zweryfikowane lokalnym testem jednostkowym na
  183-znakowym tokenie, dokładnie jak w zgłoszeniu). To dotyczyło każdego zapisu przez POST
  (ustawienia, dodawanie dashboardu), nie tylko tokenu.

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
