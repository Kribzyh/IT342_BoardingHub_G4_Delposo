# BoardingHub Backend Startup Script
# This script starts the backend with the required environment variables

param(
    [switch]$BuildFirst,
    [switch]$OpenBrowser,
    [switch]$PreferIPv6
)

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env file..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value)
            Set-Item -Path "env:$key" -Value $value
        }
    }
} else {
    Write-Host "Warning: .env file not found. Using default values." -ForegroundColor Yellow
    # Set default environment variables (update with your actual Supabase credentials)
    $env:SUPABASE_HOST = "your-project.supabase.co"
    $env:SUPABASE_PORT = "5432"
    $env:SUPABASE_DB = "postgres"
    $env:SUPABASE_USER = "postgres"
    $env:SUPABASE_PASSWORD = "your-database-password"
    $env:JWT_SECRET = "BoardingHub2024SecretKeyWithAtLeast32CharactersLongForHS256!!!"
}

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

# Validate DNS resolution for Supabase host
Write-Host "Validating database host..." -ForegroundColor Yellow
$hostToValidate = $env:SUPABASE_HOST
if ($hostToValidate -match ':') {
    # IPv6 address
    Write-Host "  • Using IPv6 address: $hostToValidate" -ForegroundColor Green
} else {
    # Hostname - try DNS resolution
    try {
        $dnsResult = Resolve-DnsName $hostToValidate -ErrorAction Stop
        if ($dnsResult.IPAddress) {
            Write-Host "  • DNS resolution successful: $($dnsResult.IPAddress)" -ForegroundColor Green
        } else {
            Write-Host "  • DNS resolution failed: No IP address found" -ForegroundColor Red
            Write-Host "  • Please check your internet connection and Supabase host" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "  • DNS resolution failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  • Please check your internet connection and Supabase host" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

Write-Host "Starting Backend Application..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "API Endpoints:" -ForegroundColor Cyan
Write-Host "  • POST /auth/register - Register new user"
Write-Host "  • POST /auth/login - Login user"
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Run the application
if ($PreferIPv6) {
    Write-Host "Using IPv6 preference for DNS resolution" -ForegroundColor Cyan
    & java @('-Djava.net.preferIPv6Addresses=true', '-Djava.net.preferIPv4Stack=false', '-Dsun.net.inetaddr.ttl=0', '-Dnetworkaddress.cache.ttl=0', '-Dnetworkaddress.cache.negative.ttl=0', '-Djava.net.useSystemProxies=true', '-jar', 'target/app-0.0.1-SNAPSHOT.jar')
} else {
    & java @('-Dsun.net.inetaddr.ttl=0', '-Dnetworkaddress.cache.ttl=0', '-Dnetworkaddress.cache.negative.ttl=0', '-Djava.net.useSystemProxies=true', '-jar', 'target/app-0.0.1-SNAPSHOT.jar')
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Application exited with error code: $LASTEXITCODE" -ForegroundColor Red
}
