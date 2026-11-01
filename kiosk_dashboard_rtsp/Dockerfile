# Obraz bazowy wg architektury (Supervisor podaje BUILD_ARCH; BUILD_FROM — jeśli poda, ma pierwszeństwo).
ARG BUILD_ARCH=amd64
ARG BUILD_FROM=ghcr.io/home-assistant/${BUILD_ARCH}-base:latest
FROM ${BUILD_FROM}
ARG BUILD_ARCH=amd64

RUN apk add --no-cache python3 chromium xvfb ffmpeg ttf-freefont curl \
 && case "$BUILD_ARCH" in \
      aarch64) MTX_ARCH=arm64 ;; \
      *)       MTX_ARCH=amd64 ;; \
    esac \
 && URL=$(curl -sS https://api.github.com/repos/bluenviron/mediamtx/releases/latest \
      | grep -o "\"browser_download_url\": *\"[^\"]*_linux_${MTX_ARCH}\.tar\.gz\"" \
      | head -1 | cut -d'"' -f4) \
 && test -n "$URL" \
 && curl -sSL -o /tmp/mediamtx.tar.gz "$URL" \
 && tar -xzf /tmp/mediamtx.tar.gz -C /usr/local/bin mediamtx \
 && chmod +x /usr/local/bin/mediamtx \
 && rm -rf /tmp/mediamtx.tar.gz /var/cache/apk/*

COPY app /app
COPY mediamtx.yml /app/mediamtx.yml
CMD [ "python3", "-u", "/app/server.py" ]
