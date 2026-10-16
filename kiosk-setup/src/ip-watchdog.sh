#!/bin/bash
#
# Sprawdza łączność sieciową; jeśli brak przez kilka kolejnych uruchomień
# (domyślnie ~15 minut przy cronie co 5 min), restartuje system.

STATE_FILE="/run/ip-watchdog.fails"
MAX_FAILS=3

GATEWAY=$(ip route | awk '/default/ {print $3; exit}')

ok=false
if [ -n "$GATEWAY" ] && ping -c 2 -W 3 "$GATEWAY" &>/dev/null; then
    ok=true
elif ping -c 2 -W 3 1.1.1.1 &>/dev/null; then
    ok=true
fi

if $ok; then
    rm -f "$STATE_FILE"
else
    fails=0
    [ -f "$STATE_FILE" ] && fails=$(cat "$STATE_FILE")
    fails=$((fails + 1))
    echo "$fails" > "$STATE_FILE"
    if [ "$fails" -ge "$MAX_FAILS" ]; then
        logger "ip-watchdog: brak łączności przez $fails prób — restart systemu"
        rm -f "$STATE_FILE"
        /sbin/reboot
    fi
fi
