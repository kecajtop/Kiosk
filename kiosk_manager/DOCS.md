# Kioski

Jeden panel do wszystkich kiosków z pakietem **kiosk-setup**, w menu bocznym Home Assistant.

## Co potrafi

- Lista kiosków ze stanem: co wyświetlają, monitor, kamery, czas pracy, dysk tylko do odczytu.
- **Otwórz panel** — pełny panel wybranego kiosku wewnątrz Home Assistant, bez osobnego logowania. Kiosk musi mieć kiosk-setup **1.0.1 lub nowszy**.
- Na wszystkich kioskach naraz: komunikat głosowy, dymek, widok, włączenie/wyłączenie ekranów, odświeżenie, aktualizacja z pliku `.deb`.
- **Szukaj w sieci** — znajduje kioski w sieci lokalnej Home Assistant.
- **Aktualizacje kiosków:** przy każdym kiosku widać, czy ma najnowszą wersję („↑ dostępna X”, przycisk
  „Aktualizuj do X”), a „Aktualizuj wszystkie z GitHuba” aktualizuje wszystkie naraz. Każdy kiosk ma też w HA
  encję „Aktualizacja” (Ustawienia → Aktualizacje) i przełącznik „Automatyczne aktualizacje”.

## Aktualizacja samego dodatku

Nowe wersje dodatku Home Assistant pokazuje w Ustawienia → Aktualizacje (po odświeżeniu sklepu dodatków).
Na karcie dodatku (Ustawienia → Dodatki → Kioski) możesz włączyć **Automatyczne aktualizacje** — wtedy HA
instaluje nowe wersje sam. Dodatek pokazuje też pasek, gdy w repozytorium jest nowsza wersja.

## Dodanie kiosku

1. Na kiosku (SSH) wypisz token: `sudo kiosk-mode api-token`.
2. W panelu **Kioski** kliknij **Szukaj w sieci** → **Dodaj** przy kiosku (albo **Dodaj kiosk** i wpisz adres).
3. Wklej token. Dodatek sprawdzi go i zapamięta.

Tokeny są zapisane tylko w dodatku (`/data/kiosks.json`, w kopii zapasowej HA). Dostęp do panelu mają użytkownicy Home Assistant z uprawnieniami administratora (jak do innych dodatków).

## Sieć

Dodatek łączy się z kioskami na porcie **8088** (HTTP w sieci lokalnej). Wyszukiwanie sprawdza sieci, w których jest Home Assistant (maks. /22); inną sieć wpisz ręcznie, np. `192.168.3.0/24`.
