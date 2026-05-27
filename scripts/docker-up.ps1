$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Starting Tesbo frontend, Nest backend, and database with Docker Compose..."
if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker compose version *> $null
  if ($LASTEXITCODE -eq 0) {
    docker compose up --build -d
  } elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    docker-compose up --build -d
  } else {
    throw "Docker Compose was not found. Install Docker Desktop or the docker-compose plugin."
  }
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
  docker-compose up --build -d
} else {
  throw "Docker was not found. Install Docker Desktop, then rerun this script."
}

Write-Host ""
Write-Host "Tesbo is starting."
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend health: http://localhost:7000/health"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  docker compose logs -f"
Write-Host "  docker compose down"
