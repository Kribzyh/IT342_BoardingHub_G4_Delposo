# BoardingHub Backend Startup Script
# This script starts the backend with the required environment variables

param(
    [switch]$BuildFirst,
    [switch]$OpenBrowser
)

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   BoardingHub Backend - Startup Script    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:SUPABASE_HOST = "db.ktgzyufkalsipngqsayn.supabase.co"
$env:SUPABASE_PORT = "5432"
$env:SUPABASE_DB = "postgres"
$env:SUPABASE_USER = "postgres"
$env:SUPABASE_PASSWORD = "BoardingHUB14637"
$env:JWT_SECRET = "BoardingHub2024SecretKeyWithAtLeast32CharactersLongForHS256!!!"

Write-Host "Environment Variables Set:" -ForegroundColor Yellow
Write-Host "  • SUPABASE_HOST: $env:SUPABASE_HOST" -ForegroundColor Gray
Write-Host "  • SUPABASE_PORT: $env:SUPABASE_PORT" -ForegroundColor Gray
Write-Host "  • JWT_SECRET: Configured" -ForegroundColor Gray
Write-Host ""

# Build if needed
if ($BuildFirst) {
    Write-Host "Building backend..." -ForegroundColor Yellow
    & ".\mvnw.cmd" clean package -DskipTests
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host ""
}

# Check if JAR exists
$jarPath = "target/app-0.0.1-SNAPSHOT.jar"
if (-not (Test-Path $jarPath)) {
    Write-Host "JAR file not found. Building..." -ForegroundColor Yellow
    & ".\mvnw.cmd" clean package -DskipTests -q
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Starting Backend Application..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "API Endpoints:" -ForegroundColor Cyan
Write-Host "  • POST /auth/register - Register new user"
Write-Host "  • POST /auth/login - Login user"
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Run the application
java -jar target/app-0.0.1-SNAPSHOT.jar

if ($LASTEXITCODE -ne 0) {
    Write-Host "Application exited with error code: $LASTEXITCODE" -ForegroundColor Red
}
