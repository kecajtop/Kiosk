# Kiosk — aplikacja na Androida

Panel kiosku kecaj (kiosk-setup) jako aplikacja na telefon:

- **fizyczne przyciski głośności** telefonu sterują głośnością kiosku (szybkie naciśnięcia
  łączą się w jeden krok; wyłączysz to w ustawieniach aplikacji albo w panelu: Dźwięk → Głośność),
- **wyszukiwanie kiosków** w sieci Wi-Fi (port 8088, `/api/ping`), kilka zapisanych kiosków,
- zapamiętany **token** administratora albo konto domownika — bez logowania przy każdym otwarciu,
- **HTTPS kiosku** (port 8443, własny certyfikat): przy pierwszym połączeniu aplikacja pokazuje
  odcisk SHA-256 certyfikatu; po potwierdzeniu ufa tylko temu certyfikatowi pod tym adresem,
- pełny ekran z panelem, przycisk **wstecz** cofa zakładki, wgrywanie plików (zdjęcia, pakiety),
  linki spoza kiosku otwierają się w przeglądarce,
- ustawienia aplikacji: Ustawienia → pierwsza pozycja „Aplikacja Kiosk”,
- po otwarciu **Pilot**: „Teraz gra”, głośność, kafelki ulubionych stacji, ekran; na dole zakładki Pilot, Kamery,
  Ustawienia; widok po otwarciu do wyboru w ustawieniach aplikacji.

Android 5.0 lub nowszy. Instalacja: skopiuj `releases/kiosk-android-1.2.apk` na telefon i otwórz
(zgoda na „instalowanie nieznanych aplikacji” dla przeglądarki lub menedżera plików).

## Budowanie

Bez Gradle i Android Studio, tylko narzędzia z Ubuntu:

```bash
sudo apt install openjdk-17-jdk-headless aapt dalvik-exchange zipalign apksigner android-sdk-platform-23
KEYSTORE=~/kiosk-android.keystore ./build.sh      # -> dist/kiosk-android-<wersja>.apk
```

Aktualizację aplikacji trzeba podpisać **tym samym kluczem** (`KEYSTORE`, hasło `KEYSTORE_PASS`),
inaczej Android jej nie zainstaluje na starą wersję. Klucza nie ma w repozytorium.
