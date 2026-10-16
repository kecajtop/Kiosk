# Obraz bazowy wg architektury (Supervisor podaje BUILD_ARCH; BUILD_FROM — jeśli poda, ma pierwszeństwo).
ARG BUILD_ARCH=amd64
ARG BUILD_FROM=ghcr.io/home-assistant/${BUILD_ARCH}-base:latest
FROM ${BUILD_FROM}
RUN apk add --no-cache python3
COPY app /app
CMD [ "python3", "-u", "/app/server.py" ]
