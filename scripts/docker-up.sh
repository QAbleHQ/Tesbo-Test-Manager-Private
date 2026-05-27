#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting Tesbo frontend, Nest backend, and database with Docker Compose..."
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose up --build -d
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up --build -d
else
  echo "Docker Compose was not found. Install Docker Desktop or the docker-compose plugin." >&2
  exit 1
fi

echo
echo "Tesbo is starting."
echo "Frontend: http://localhost:3000"
echo "Backend health: http://localhost:7000/health"
echo
echo "Useful commands:"
echo "  docker compose logs -f"
echo "  docker compose down"
