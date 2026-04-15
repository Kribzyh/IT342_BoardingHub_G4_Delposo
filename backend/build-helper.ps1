# BoardingHub Backend Build Helper Script
# This PowerShell script helps troubleshoot and build the backend

param(
    [switch]$InstallMaven,
    [switch]$ClearCache,
    [switch]$TestConnection,
    [switch]$Verbose,
    [string]$MavenVersion = "3.9.11"
)

function Write-Header {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host "=" -NoNewline
    Write-Host " $Message " -NoNewline
    Write-Host "=" 
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# Test Connection to Maven Repositories
function Test-Maven-Connection {
    Write-Header "Testing Maven Repository Connectivity"
    
    $repos = @(
        "repo.maven.apache.org",
        "archive.apache.org",
        "maven.repository.redhat.com"
    )
    
    foreach ($repo in $repos) {
        Write-Info "Testing connection to $repo..."
        try {
            $result = Test-Connection -ComputerName $repo -Count 1 -ErrorAction Stop
            Write-Success "Connected to $repo"
        } catch {
            Write-Error-Custom "Cannot connect to $repo"
        }
    }
}

# Clear Maven Cache
function Clear-Maven-Cache {
    Write-Header "Clearing Maven Cache"
    
    $m2Home = "$env:USERPROFILE\.m2"
    $wrapperDir = "$m2Home\wrapper"
    $repoDir = "$m2Home\repository"
    
    Write-Info "Clearing wrapper cache..."
    if (Test-Path $wrapperDir) {
        Remove-Item -Recurse -Force $wrapperDir
        Write-Success "Wrapper cache cleared"
    } else {
        Write-Info "No wrapper cache found"
    }
    
    Write-Info "Do you want to clear the entire repository cache? This will re-download all dependencies."
    Write-Info "This is only needed if there are corrupted files."
    $response = Read-Host "Clear repository cache? (y/n)"
    
    if ($response -eq "y") {
        if (Test-Path $repoDir) {
            Remove-Item -Recurse -Force $repoDir
            Write-Success "Repository cache cleared"
        }
    }
}

# Install Maven
function Install-Maven-Local {
    Write-Header "Installing Maven Locally"
    
    $mavenPath = "C:\Maven\apache-maven-$MavenVersion"
    
    if (Test-Path "$mavenPath\bin\mvn.cmd") {
        Write-Success "Maven $MavenVersion is already installed at $mavenPath"
        return
    }
    
    $zipPath = "C:\Maven\maven-$MavenVersion.zip"
    $downloadUrl = "https://archive.apache.org/dist/maven/maven-3/$MavenVersion/binaries/apache-maven-$MavenVersion-bin.zip"
    
    Write-Info "This will download Maven $MavenVersion (~9MB)"
    Write-Info "Download URL: $downloadUrl"
    
    try {
        # Ensure Maven directory exists
        if (-not (Test-Path "C:\Maven")) {
            New-Item -ItemType Directory -Path "C:\Maven" -Force | Out-Null
            Write-Info "Created C:\Maven directory"
        }
        
        # Enable TLS 1.2
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        
        Write-Info "Downloading Maven..."
        (New-Object Net.WebClient).DownloadFile($downloadUrl, $zipPath)
        Write-Success "Downloaded Maven to $zipPath"
        
        Write-Info "Extracting Maven..."
        Expand-Archive -Path $zipPath -DestinationPath "C:\Maven" -Force
        Write-Success "Extracted Maven to C:\Maven"
        
        # Remove zip
        Remove-Item -Path $zipPath -Force
        
        # Add to PATH for current session
        $env:Path += ";$mavenPath\bin"
        Write-Success "Added Maven to PATH for current session"
        
        Write-Info "To add permanently, manually add to System Environment Variables:"
        Write-Info "  MAVEN_HOME = $mavenPath"
        Write-Info "  Add %MAVEN_HOME%\bin to PATH"
        
        # Verify
        Write-Info "Verifying Maven installation..."
        & mvn --version
        
    } catch {
        Write-Error-Custom "Failed to install Maven: $_"
        return $false
    }
    
    return $true
}

# Enable TLS
function Enable-TLS-Strong {
    Write-Header "Enabling Strong TLS Support"
    
    Write-Info "Setting TLS 1.2 and 1.3 as default..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Write-Success "TLS 1.2 and 1.3 enabled"
    Write-Info "This setting is only for the current PowerShell session"
}

# Build Project
function Build-Project {
    Write-Header "Building Backend Project"
    
    $backendPath = Get-Location
    if (-not (Test-Path "pom.xml")) {
        Write-Error-Custom "pom.xml not found. Please run this script from the backend directory"
        return $false
    }
    
    Write-Info "Enabling strong TLS..."
    Enable-TLS-Strong
    
    Write-Info "Building backend with Maven..."
    if ($Verbose) {
        & .\mvnw.cmd clean install -DskipTests -X
    } else {
        & .\mvnw.cmd clean install -DskipTests
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Build completed successfully!"
        return $true
    } else {
        Write-Error-Custom "Build failed with exit code $LASTEXITCODE"
        Write-Info "Run with -Verbose flag for more information"
        return $false
    }
}

# Main Menu
function Show-Menu {
    Write-Header "BoardingHub Backend Build Helper"
    
    Write-Host "1. Build Project (with Maven wrapper)"
    Write-Host "2. Install Maven Locally"
    Write-Host "3. Test Repository Connectivity"
    Write-Host "4. Clear Maven Cache"
    Write-Host "5. Enable Strong TLS"
    Write-Host "6. Full Troubleshooting (All Steps)"
    Write-Host "7. Exit"
    Write-Host ""
}

# Main Logic
if ($PSBoundParameters.Count -eq 0 -or ($PSBoundParameters.Count -eq 1 -and $Verbose)) {
    # Interactive mode
    do {
        Show-Menu
        $choice = Read-Host "Select an option (1-7)"
        
        switch ($choice) {
            "1" {
                Build-Project
            }
            "2" {
                Install-Maven-Local
            }
            "3" {
                Test-Maven-Connection
            }
            "4" {
                Clear-Maven-Cache
            }
            "5" {
                Enable-TLS-Strong
            }
            "6" {
                Write-Header "Running Full Troubleshooting"
                Test-Maven-Connection
                Enable-TLS-Strong
                Clear-Maven-Cache
                Install-Maven-Local
            }
            "7" {
                Write-Info "Exiting..."
                break
            }
            default {
                Write-Error-Custom "Invalid option"
            }
        }
    } while ($choice -ne "7")
} else {
    # Command line mode
    if ($TestConnection) {
        Test-Maven-Connection
    }
    if ($ClearCache) {
        Clear-Maven-Cache
    }
    if ($InstallMaven) {
        Install-Maven-Local
    }
}

Write-Host ""
Write-Info "For more information, see: MAVEN_TROUBLESHOOTING.md"
Write-Info "For Supabase setup, see: SUPABASE_SETUP.md"
