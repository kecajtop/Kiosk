#!/bin/bash
#
# kiosk-netconfig.sh
# Interaktywna konfiguracja sieci (DHCP / statyczny IP / WiFi) przez netplan.
# Uruchamiaj przez SSH jako root: sudo kiosk-netconfig.sh
#
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
    echo "Uruchom jako root (sudo kiosk-netconfig.sh)." >&2
    exit 1
fi

echo "Dostępne interfejsy sieciowe:"
ip -brief link show | awk '{print "  - "$1}' | grep -v lo

read -rp "Nazwa interfejsu do skonfigurowania: " IFACE
read -rp "Tryb [dhcp/static]: " MODE

NETPLAN_FILE="/etc/netplan/90-kiosk-network.yaml"

if [ "$MODE" = "static" ]; then
    read -rp "Adres IP z maską (np. 192.168.0.200/24): " IPADDR
    read -rp "Brama domyślna (np. 192.168.0.1): " GATEWAY
    read -rp "Serwery DNS (oddzielone przecinkiem, np. 1.1.1.1,8.8.8.8): " DNS

    read -rp "Czy to interfejs WiFi? [t/N]: " IS_WIFI
    if [[ "$IS_WIFI" =~ ^[tT]$ ]]; then
        read -rp "SSID sieci WiFi: " SSID
        read -rsp "Hasło WiFi: " PASSWORD
        echo ""
        cat > "$NETPLAN_FILE" <<EOF
network:
  version: 2
  wifis:
    $IFACE:
      dhcp4: no
      addresses: [$IPADDR]
      routes:
        - to: default
          via: $GATEWAY
      nameservers:
        addresses: [$DNS]
      access-points:
        "$SSID":
          password: "$PASSWORD"
EOF
    else
        cat > "$NETPLAN_FILE" <<EOF
network:
  version: 2
  ethernets:
    $IFACE:
      dhcp4: no
      addresses: [$IPADDR]
      routes:
        - to: default
          via: $GATEWAY
      nameservers:
        addresses: [$DNS]
EOF
    fi
else
    read -rp "Czy to interfejs WiFi? [t/N]: " IS_WIFI
    if [[ "$IS_WIFI" =~ ^[tT]$ ]]; then
        read -rp "SSID sieci WiFi: " SSID
        read -rsp "Hasło WiFi: " PASSWORD
        echo ""
        cat > "$NETPLAN_FILE" <<EOF
network:
  version: 2
  wifis:
    $IFACE:
      dhcp4: yes
      access-points:
        "$SSID":
          password: "$PASSWORD"
EOF
    else
        cat > "$NETPLAN_FILE" <<EOF
network:
  version: 2
  ethernets:
    $IFACE:
      dhcp4: yes
EOF
    fi
fi

chmod 600 "$NETPLAN_FILE"
echo "Zapisano $NETPLAN_FILE. Zastosować teraz? (połączenie SSH może się zerwać, jeśli zmienia się IP)"
read -rp "Zastosować? [t/N]: " APPLY
if [[ "$APPLY" =~ ^[tT]$ ]]; then
    netplan apply
    echo "Zastosowano. Nowy adres IP:"
    ip -4 -brief addr show "$IFACE"
else
    echo "Zmiany zapisane, ale nie zastosowane. Uruchom 'sudo netplan apply' ręcznie, gdy będziesz gotów."
fi
