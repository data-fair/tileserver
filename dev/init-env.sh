#!/bin/bash

RANDOM_NB=$((1024 + RANDOM % 48000))
echo "Use random base port $RANDOM_NB"

cat <<EOF > ".env"
DEV_PORT=$((RANDOM_NB))
MONGO_PORT=$((RANDOM_NB + 10))
REGISTRY_PORT=$((RANDOM_NB + 20))

REGISTRY_URL=http://localhost:$((RANDOM_NB + 20))
REGISTRY_SECRET=dev-secret
DATA_DIR=./dev/data
PORT=$((RANDOM_NB))
LOG_LEVEL=debug
OBSERVER_ACTIVE=false
EOF
