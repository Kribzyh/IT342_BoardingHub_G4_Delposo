# Maven Wrapper Network Issues - Troubleshooting Guide

## Problem
Maven wrapper fails with error:
```
Exception calling "DownloadFile" with "2" argument(s): "The underlying connection was closed"
Cannot start maven from wrapper
```

## Root Cause
The Maven wrapper cannot download Maven distribution files from the repository due to network/connectivity issues.

## Solutions (Try in Order)

### Solution 1: Update Maven Mirror (DONE ✓)

The Maven wrapper configuration has been updated to use Apache's Archive mirror:
- **Old URL**: `https://repo.maven.apache.org/maven2/...` 
- **New URL**: `https://archive.apache.org/dist/maven/maven-3/...` (More reliable)

Try building again:
```powershell
cd backend
.\mvnw.cmd clean install -DskipTests
```

If this still doesn't work, proceed to Solution 2.

---

### Solution 2: Enable Strong TLS Support

PowerShell may need explicit TLS 1.2/1.3 configuration:

```powershell
# Run this BEFORE the Maven command
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

# Then run Maven
.\mvnw.cmd clean install -DskipTests
```

Or create a profile in PowerShell:

```powershell
# Edit your PowerShell profile
notepad $PROFILE

# Add this line
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

# Reload profile
. $PROFILE
```

---

### Solution 3: Install Maven Locally (RECOMMENDED)

#### Windows 10/11:

**Step 1: Download Maven**
1. Go to https://maven.apache.org/download.cgi
2. Download **Binary zip archive** (e.g., `apache-maven-3.9.11-bin.zip`)
3. Extract to `C:\Maven` or similar

**Step 2: Configure Environment Variable**
1. Right-click **This PC** → **Properties**
2. Click **Advanced system settings**
3. Click **Environment Variables**
4. Under **User variables**, click **New**
   - Variable name: `MAVEN_HOME`
   - Variable value: `C:\Maven\apache-maven-3.9.11`
5. Edit **Path** variable and add: `%MAVEN_HOME%\bin`
6. Click OK and close all dialogs

**Step 3: Verify Installation**
```powershell
# Open new PowerShell
mvn --version

# Output should show:
# Apache Maven 3.9.11
# ...
```

**Step 4: Build Project**
```powershell
cd C:\Users\...\backend
mvn clean install -DskipTests
```

---

### Solution 4: Check Network Connectivity

Test if your system can reach Maven repositories:

```powershell
# Test connection to Maven Central
Test-Connection repo.maven.apache.org -Count 1

# Test connection to Apache Archive
Test-Connection archive.apache.org -Count 1

# Test HTTPS connectivity (more detailed)
Test-NetConnection -ComputerName archive.apache.org -Port 443 -InformationLevel Detailed
```

---

### Solution 5: Check Proxy/Firewall Settings

Your network may be blocking direct access to repositories:

```powershell
# Check Windows proxy settings
netsh winhttp show proxy

# If proxy is configured, you may need to configure Maven to use it
# Edit C:\Users\<username>\.m2\settings.xml and add proxy configuration
```

If your company uses a proxy:
1. Edit `C:\Users\<username>\.m2\settings.xml`
2. Add proxy configuration:
```xml
<settings>
  <proxies>
    <proxy>
      <id>corporate</id>
      <active>true</active>
      <protocol>http</protocol>
      <host>proxy.company.com</host>
      <port>8080</port>
      <username>username</username>
      <password>password</password>
      <nonProxyHosts>localhost|127.0.0.1</nonProxyHosts>
    </proxy>
  </proxies>
</settings>
```

---

### Solution 6: Use Docker (If Installed)

If you have Docker installed, use it to build:

```powershell
cd C:\Users\...\IT342_BoardingHub_G4_Delposo\backend

# Build inside Docker container
docker run --rm -v ${PWD}:/app -w /app maven:3.9-eclipse-temurin-17 mvn clean install -DskipTests
```

This avoids any local network/TLS issues since Maven runs in an isolated environment.

---

### Solution 7: Manual Wrapper Cache Clear

Sometimes the wrapper cache gets corrupted:

```powershell
# Remove Maven wrapper cache
Remove-Item -Recurse "$env:USERPROFILE\.m2\wrapper" -Force

# Try building again
.\mvnw.cmd clean install -DskipTests
```

---

## Advanced Troubleshooting

### Check Maven Wrapper Version
```powershell
cat .\.mvn\wrapper\maven-wrapper.properties
```

### Use Verbose Output
Get more detailed error information:

```powershell
.\mvnw.cmd clean install -X -DskipTests 2>&1 | tee build.log
```

This creates a `build.log` file with detailed output.

### Download Maven Manually

If all else fails, download Maven directly:

```powershell
# Create Maven directory
New-Item -ItemType Directory -Path "C:\Maven" -Force

# Download Maven (example URL - check for latest version)
$url = "https://archive.apache.org/dist/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.zip"
$outPath = "C:\Maven\maven.zip"

# Use WebClient to download (with TLS support)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
(New-Object Net.WebClient).DownloadFile($url, $outPath)

# Extract
Expand-Archive -Path C:\Maven\maven.zip -DestinationPath C:\Maven

# Add to PATH
$env:Path += ";C:\Maven\apache-maven-3.9.11\bin"

# Verify
mvn --version
```

---

## Quick Decision Tree

```
Is Maven Wrapper failing?
├─ YES
│  ├─ Can you install Maven system-wide?
│  │  └─ YES → Solution 3 (Install Maven Locally)
│  ├─ Do you have Docker?
│  │  └─ YES → Solution 6 (Use Docker)
│  ├─ Are you behind a corporate proxy?
│  │  └─ YES → Solution 5 (Configure Proxy)
│  └─ Otherwise → Try Solutions 1, 2, 7 in order
```

---

## Still Not Working?

1. **Document the error**: Run with verbose logging and save output
2. **Check Java version**: Ensure Java 17+ is installed
3. **Check disk space**: Ensure you have at least 2GB free
4. **Try on different network**: Use mobile hotspot or public WiFi to test
5. **Reset Maven cache**: Delete `~/.m2/repository` folder (will re-download dependencies)

---

## Next Steps After Build Succeeds

Once `mvn clean install -DskipTests` completes successfully:

```powershell
# Navigate to backend
cd backend

# Create .env file with Supabase credentials
Copy-Item ".env.example" ".env"	

# Edit .env with your Supabase credentials
notepad .env

# Run the application
mvn spring-boot:run

# Or build and run standalone
mvn clean package -DskipTests
java -jar target/app-0.0.1-SNAPSHOT.jar
```

The application should start on `http://localhost:8080`

---

**Questions or issues?** Check the main [SUPABASE_SETUP.md](SUPABASE_SETUP.md) and [QUICK_START.md](QUICK_START.md) files.
