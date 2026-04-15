# Backend Quick Start Checklist

## Issues Fixed ✓

1. **Invalid Maven Dependencies**: Fixed 4 invalid test dependency declarations in `pom.xml`
   - Replaced incorrect artifacts: `spring-boot-starter-*-test` 
   - With correct artifact: `spring-boot-starter-test`

2. **Supabase Configuration Template**: Created `.env.example` with required credentials

3. **Setup Documentation**: Created `SUPABASE_SETUP.md` with complete Supabase setup guide

## Before Running the Application

- [ ] Create a Supabase account and project at https://supabase.com
- [ ] Copy `.env.example` to `.env` in the backend folder
- [ ] Update `.env` with your actual Supabase credentials:
  ```
  SUPABASE_HOST=your-project.supabase.co
  SUPABASE_PORT=5432
  SUPABASE_DB=postgres
  SUPABASE_USER=postgres
  SUPABASE_PASSWORD=your-password
  JWT_SECRET=your-secret-key-min-32-chars
  ```
- [ ] Verify `.env` is in `.gitignore` (do not commit this file)

## Building the Project

### Option 1: Using Maven Wrapper (Recommended)
```bash
cd backend
./mvnw clean install -DskipTests
```

### Option 2: If Maven Wrapper Fails (Network Issues)

If you see errors like "The underlying connection was closed", follow these steps:

#### Step 1: Install Maven Manually
1. Download Maven 3.9.11+ from https://maven.apache.org/download.cgi
2. Extract to a folder (e.g., `C:\Maven`)
3. Add to your system PATH:
   - Windows: Add `C:\Maven\bin` to System Environment Variables → PATH
   - Verify: Open new PowerShell and run `mvn --version`

#### Step 2: Build with Installed Maven
```bash
cd backend
mvn clean install -DskipTests
```

### Option 3: Using Docker (Alternative)

If you have Docker installed:

```bash
cd backend
docker run --rm -v %CD%:/app -w /app maven:3.9-eclipse-temurin-17 mvn clean install -DskipTests
```

### Option 4: Direct Java Compilation (Advanced)

If all else fails, you can compile manually:

```bash
cd backend/src/main/java
javac -version  # Ensure Java 17+ is installed
# Then run the compiled classes with your CLASSPATH properly set
```

## Troubleshooting Maven Wrapper Issues

### Problem: "The underlying connection was closed"

**Causes:**
- Network/firewall blocking Maven repository access
- TLS/SSL certificate issues
- ISP/Proxy blocking download sites

**Solutions:**

1. **Enable TLS 1.2/1.3 in PowerShell:**
```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
.\mvnw.cmd clean install -DskipTests
```

2. **Try alternate Maven mirror:**
The wrapper is now configured to use Apache's archive mirror instead of the default repo.
Try running again: `.\mvnw.cmd clean install -DskipTests`

3. **Check your internet connection:**
```powershell
Test-Connection -ComputerName repo.maven.apache.org -Count 1
Test-Connection -ComputerName archive.apache.org -Count 1
```

4. **Check proxy settings:**
```powershell
netsh winhttp show proxy
```

5. **Bypass wrapper entirely:**
Install Maven system-wide and use `mvn` command directly instead of `./mvnw`

## Running the Application

Once your build completes successfully:

```bash
./mvnw spring-boot:run
```

Or with system Maven:
```bash
mvn spring-boot:run
```

Or build and run the JAR:

```bash
./mvnw clean package -DskipTests
java -jar target/app-0.0.1-SNAPSHOT.jar
```

## API Endpoints

### Authentication
- **Register**: `POST /auth/register`
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "fullName": "John Doe",
    "role": "TENANT"
  }
  ```

- **Login**: `POST /auth/login`
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

Response includes JWT token to use in subsequent requests.

## Default Configuration

- **Server Port**: 8080
- **CORS Allowed Origins**: http://localhost:3000 (for React frontend)
- **Database**: PostgreSQL (Supabase)
- **Security**: JWT-based authentication
- **DDL Auto**: Update (creates/updates tables on startup)

## Verify Connection

Once the app starts, look for logs indicating successful database connection:

```
Hibernate: alter table if exists users drop constraint if exists UK_...
Hibernate: create table users (...)
```

## Troubleshooting

See `SUPABASE_SETUP.md` for detailed troubleshooting guide.

For issues with Maven builds, ensure you have:
- Java 17+ installed
- Maven installed or use the embedded `./mvnw` script
- Internet connection for downloading dependencies
