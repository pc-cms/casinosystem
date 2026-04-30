#!/usr/bin/env bash
#
# WireGuard peer manager для cms-vpn контейнера.
# Usage:
#   sudo ./add-peer.sh <peer-name>   # генерирует ключи, добавляет в конфиг, печатает QR
#   sudo ./add-peer.sh --list
#   sudo ./add-peer.sh --remove <peer-name>
#
# Контейнер: cms-vpn (linuxserver/wireguard), конфиги в ./vpn/config/
#
set -euo pipefail

VPN_DIR="$(cd "$(dirname "$0")" && pwd)/config"
SERVER_PUB_FILE="$VPN_DIR/server/publickey"
SERVER_CONF="$VPN_DIR/wg_confs/wg0.conf"
PEERS_DIR="$VPN_DIR/peers"
mkdir -p "$PEERS_DIR"

. "$(dirname "$0")/../.env" 2>/dev/null || true
SERVER_ENDPOINT="${LOCAL_IP:-127.0.0.1}:51820"
VPN_SUBNET="${VPN_SUBNET:-10.66.0}"

list_peers() {
  ls -1 "$PEERS_DIR" 2>/dev/null | sed 's|/$||' || true
}

next_ip() {
  local used; used=$(grep -h "AllowedIPs" "$SERVER_CONF" 2>/dev/null | grep -oE "${VPN_SUBNET}\.[0-9]+" | sort -u || true)
  for i in $(seq 2 254); do
    if ! echo "$used" | grep -q "${VPN_SUBNET}\.${i}\b"; then echo "${VPN_SUBNET}.${i}"; return; fi
  done
  echo "ERROR: subnet exhausted" >&2; exit 1
}

case "${1:-}" in
  --list) list_peers; exit 0 ;;
  --remove)
    name="${2:?peer name required}"
    rm -rf "$PEERS_DIR/$name"
    sed -i "/^# BEGIN $name$/,/^# END $name$/d" "$SERVER_CONF"
    docker compose restart cms-vpn
    echo "✓ Removed peer $name"; exit 0 ;;
  "") echo "Usage: $0 <peer-name> | --list | --remove <name>"; exit 1 ;;
esac

NAME="$1"
[[ -d "$PEERS_DIR/$NAME" ]] && { echo "Peer $NAME already exists"; exit 1; }

mkdir -p "$PEERS_DIR/$NAME"
PRIV=$(docker run --rm --entrypoint wg linuxserver/wireguard genkey)
PUB=$(echo "$PRIV" | docker run --rm -i --entrypoint wg linuxserver/wireguard pubkey)
PSK=$(docker run --rm --entrypoint wg linuxserver/wireguard genpsk)
PEER_IP=$(next_ip)
SERVER_PUB=$(cat "$SERVER_PUB_FILE")

cat > "$PEERS_DIR/$NAME/$NAME.conf" <<EOF
[Interface]
PrivateKey = $PRIV
Address = $PEER_IP/32
DNS = 1.1.1.1

[Peer]
PublicKey = $SERVER_PUB
PresharedKey = $PSK
AllowedIPs = ${VPN_SUBNET}.0/24
Endpoint = $SERVER_ENDPOINT
PersistentKeepalive = 25
EOF

cat >> "$SERVER_CONF" <<EOF

# BEGIN $NAME
[Peer]
PublicKey = $PUB
PresharedKey = $PSK
AllowedIPs = $PEER_IP/32
# END $NAME
EOF

docker compose restart cms-vpn

echo
echo "═══════════════════════════════════════════════"
echo "  Peer:    $NAME"
echo "  IP:      $PEER_IP"
echo "  Config:  $PEERS_DIR/$NAME/$NAME.conf"
echo "═══════════════════════════════════════════════"
echo
echo "QR-код для мобильного приложения WireGuard:"
echo
which qrencode >/dev/null 2>&1 || apt-get install -y qrencode >/dev/null
qrencode -t ansiutf8 < "$PEERS_DIR/$NAME/$NAME.conf"
