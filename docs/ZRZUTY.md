# Zrzuty ekranu

Zrzuty z wersji 1.0.3: ekran 1280×720, panel w przeglądarce 1400×900 i na telefonie. Dane są przykładowe.

## Zegary

Wygląd wybiera się w panelu: **Ekran → Co wyświetla kiosk → Wygląd zegara**. Zegar może być nakładką w rogu,
kafelkiem w siatce kamer albo zegarem nocnym na cały ekran.

| | |
|---|---|
| **Klasyczny**<br>![](img/clock-classic.png) | **Klapkowy (flip)**<br>![](img/clock-flip.png) |
| **Analogowy** (z sekundnikiem)<br>![](img/clock-analog.png) | **Woltomierze** (godz./min./sek.)<br>![](img/clock-volt.png) |
| **7-segmentowy** (z sekundami)<br>![](img/clock-seg7.png) | **Matryca LED**<br>![](img/clock-matrix.png) |
| **LCD 1602** (duże cyfry)<br>![](img/clock-lcd1602.png) | **LCD 2004** (duże cyfry, data)<br>![](img/clock-lcd2004.png) |
| **Wąż** (animacja)<br>![](img/clock-snake.png) | **Platformówka** (animacja)<br>![](img/clock-platform.png) |
| **Komputer 8-bit** (animacja)<br>![](img/clock-c64.png) | **Niebieski ekran** (animacja)<br>![](img/clock-bsod.png) |
| **Oczy z zegarem** (animacja)<br>![](img/clock-eyes.png) | **Same oczy** (animacja)<br>![](img/clock-eyes_only.png) |
| **Oczy robota z zegarem** (animacja, wyraz twarzy)<br>![](img/clock-robot.png) | **Same oczy robota**<br>![](img/clock-robot_only.png) |
| **Zegar słowny (PL)**<br>![](img/clock-words_pl.png) | **Zegar słowny (EN)**<br>![](img/clock-words_en.png) |
| **Zegar radiowy (LCD)**<br>![](img/clock-dcf.png) | **Kod czasu DCF77**<br>![](img/clock-dcf77.png) |
| **LED z pierścieniem**<br>![](img/clock-ledring.png) | **Minimalistyczny**<br>![](img/clock-minimal.png) |
| **Woltomierze kwadratowe**<br>![](img/clock-voltsq.png) | |

Podświetlenie LCD może być zielone, niebieskie albo bursztynowe. Oczy (ludzkie i robota) reagują na mowę kiosku: patrzą na rozmówcę, pulsują w rytm głosu i zmieniają wyraz zależnie od treści komunikatu.

## Panel WWW kiosku

Adres panelu: `http://<kiosk>:8088`.

| | |
|---|---|
| **Pilot** — radio, głośność, ekran<br>![](img/panel-start.png) | **Ekran → Co wyświetla kiosk**<br>![](img/panel-tryb.png) |
| **Ekran → Widoki**<br>![](img/panel-widoki.png) | **Ekran → Monitory**<br>![](img/panel-monitory.png) |
| **Ekran → Jasność i wyłączanie**<br>![](img/panel-zasilanie.png) | **Wygląd zegara**<br>![](img/panel-wyglad-zegara.png) |
| **Komunikaty → Powiedz**<br>![](img/panel-powiedz.png) | **Dźwięk → Radio**<br>![](img/panel-radio.png) |
| **Połączenia → Wi-Fi i sieć**<br>![](img/panel-wifi.png) | **Połączenia → MQTT**<br>![](img/panel-mqtt.png) |
| **System → Nazwa kiosku**<br>![](img/panel-nazwa.png) | **Automatyka → Rozpoznawanie twarzy**<br>![](img/panel-twarze.png) |
| **System → Aktualizacje** (GitHub)<br>![](img/panel-aktualizacje.png) | **System → Dysk tylko do odczytu**<br>![](img/panel-dysk.png) |
| **System → Diagnostyka**<br>![](img/panel-debug.png) | **Na telefonie**<br>![](img/panel-telefon.png) |

## Dodatek Home Assistant „Kioski”

Wszystkie kioski w jednym miejscu, w menu bocznym Home Assistant. Dodatek pozwala:
- wysłać komunikat, dymek, widok albo aktualizację na wszystkie kioski naraz,
- otworzyć panel każdego kiosku,
- wyszukać kioski w sieci.

![](img/dodatek-ha.png)
