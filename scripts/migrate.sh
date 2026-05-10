#!/bin/bash
# scripts/migrate.sh

# Exit immediately if a command exits a non-zero status.
set -e

# Default DATABASE_URL if not set. Adjust to match your docker-compose.yml or environment.
# For local development, you might use a direct connection string or expect it via env.
DATABASE_URL=${DATABASE_URL:-postgres://postgres:password@db:5432/mcp?sslmode=disable}
MIGRATIONS_DIR="./migrations" # Assuming migrations are in this directory

COMMAND=$1
VERSION=$2 # Optional: for version-specific commands like up-to, down-to

echo "Using DATABASE_URL: $DATABASE_URL"
echo "Using MIGRATIONS_DIR: $MIGRATIONS_DIR"

# Ensure migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory '$MIGRATIONS_DIR' not found."
    exit 1
fi

# Download migrate binary if not found, or use a known version.
# For simplicity, assume migrate CLI is available or will be installed by user.
# You might add logic here to download it if needed.

case "$COMMAND" in
    "create")
        if [ -z "$VERSION" ]; then
            echo "Usage: $0 create <migration_name>"
            exit 1
        fi
        migrate create -dir "$MIGRATIONS_DIR" -seq "$VERSION"
        ;;
    "up")
        migrate -path "$MIGRATIONS_DIR" -database "$DATABASE_URL" -verbose up
        ;;
    "down")
        migrate -path "$MIGRATIONS_DIR" -database "$DATABASE_URL" -verbose down
        ;;
    "up-to")
        if [ -z "$VERSION" ]; then
            echo "Usage: $0 up-to <version_number>"
            exit 1
        fi
        migrate -path "$MIGRATIONS_DIR" -database "$DATABASE_URL" -verbose goto "$VERSION"
        ;;
    "down-to")
        if [ -z "$VERSION" ]; then
            echo "Usage: $0 down-to <version_number>"
            exit 1
        fi
        migrate -path "$MIGRATIONS_DIR" -database "$DATABASE_URL" -verbose goto "$VERSION"
        ;;
    "goto")
        if [ -z "$VERSION" ]; then
            echo "Usage: $0 goto <version_number>"
            exit 1
        fi
        migrate -path "$MIGRATIONS_DIR" -database "$DATABASE_URL" -verbose goto "$VERSION"
        ;;
    "version")
        migrate -path "$MIGRATIONS_DIR" -database "$DATABASE_URL" version
        ;;
    *)
        echo "Usage: $0 {create|up|down|up-to|down-to|goto|version} [version_number]"
        exit 1
        ;;
esac