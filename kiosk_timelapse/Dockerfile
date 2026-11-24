# Obraz bazowy wg architektury (Supervisor podaje BUILD_ARCH; BUILD_FROM — jeśli poda, ma pierwszeństwo).
ARG BUILD_ARCH=amd64
ARG BUILD_FROM=ghcr.io/home-assistant/${BUILD_ARCH}-base:latest
FROM ${BUILD_FROM}
ARG BUILD_ARCH=amd64

# Obraz bazowy HA (ghcr.io/home-assistant/*-base) ma ENTRYPOINT /init (s6-overlay v3).
# Bez usługi w /etc/services.d/ (mamy tylko goły CMD) s6-overlay przy starcie RESETUJE
# środowisko procesu do absolutnego minimum (widzieliśmy w logu tylko PATH/PWD/OLDPWD/
# SHLVL) i NIE przepuszcza zmiennych, które Docker/Supervisor wstrzyknęły do kontenera -
# w tym SUPERVISOR_TOKEN. To właśnie był cały powód, dla którego token nigdy nie
# docierał do aplikacji mimo poprawnych uprawnień (hassio_api/homeassistant_api) po
# stronie Supervisora. S6_KEEP_ENV=1 każe s6-overlay zachować pełne środowisko kontenera
# zamiast je czyścić.
ENV S6_KEEP_ENV=1

# "nice" (busybox) do uruchamiania renderowania wideo z niższym priorytetem CPU - patrz
# komentarz przy _niced() w server.py. python3 + ffmpeg to jedyne realne zależności:
# ffmpeg łapie klatki z RTSP (-rtsp_transport tcp, jedna klatka na raz) i składa je w mp4
# (concat demuxer); nie potrzebujemy tu żadnego serwera RTSP/Xvfb/Chromium - w odróżnieniu
# od dodatku Dashboard RTSP, ten dodatek tylko ODCZYTUJE istniejące strumienie RTSP.
RUN apk add --no-cache python3 ffmpeg

COPY app /app
CMD [ "python3", "-u", "/app/server.py" ]
