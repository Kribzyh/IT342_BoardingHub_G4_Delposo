# Backend Setup Complete! ✓

## Status: READY TO RUN

The backend has been successfully built and configured to connect to your Supabase database.

### What Was Fixed

1. **Invalid Maven Dependencies** ✓
   - Fixed 4 non-existent test dependency declarations in `pom.xml`
   - Added H2 database for testing

2. **Test Configuration** ✓
   - Created `application-test.yml` with H2 in-memory database
   - Updated test class to use test profile
   - Tests now pass without database requirements

3. **Database Configuration** ✓
   - Configured PostgreSQL/Supabase connection in `application.yml`
   - Set proper Hibernate dialect for PostgreSQL
   - Environment variables properly configured in `.env`

4. **Build Process** ✓
   - Fixed Maven wrapper mirror URL (using Apache Archive)
   - Updated wrapper configuration for TLS compatibility
   - Build completes successfully with no errors

5. **Application Startup** ✓
   - Created startup scripts (batch and PowerShell)
   - Application connects to Supabase successfully
   - Tomcat server initializes on port 8080

## How to Run the Backend

### Option 1: Using PowerShell Script (RECOMMENDED)
```powershell
cd backend
.\start.ps1
```

To build first:
```powershell
.\start.ps1 -BuildFirst
```

### Option 2: Using Batch Script
```cmd
cd backend
.\run.cmd
```

### Option 3: Direct Java Execution
```powershell
cd backend
[Ensure .env file exists with credentials]
java -jar target/app-0.0.1-SNAPSHOT.jar
```

### Option 4: Using Maven
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

## Verification

Once the backend starts, you should see:
```
Tomcat started on port(s): 8080 (http)
Started BackendApplication in X seconds
```

The server will be available at `http://localhost:8080`

## Testing the API

### Register a new user
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d {
    "email": "user@example.com",
    "password": "password123",
    "fullName": "John Doe",
    "role": "TENANT"
  }
```

### Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d {
    "email": "user@example.com",
    "password": "password123"
  }
```

## Environment Variables

All environment variables are stored in `.env`:
- `SUPABASE_HOST` - Your Supabase server host
- `SUPABASE_PORT` - PostgreSQL port (5432)
- `SUPABASE_DB` - Database name (postgres)
- `SUPABASE_USER` - Database user (postgres)
- `SUPABASE_PASSWORD` - Your database password
- `JWT_SECRET` - JWT signing secret

**⚠️ Important:** Do NOT commit `.env` to version control. It's already in `.gitignore`.

## Troubleshooting

### Application won't start?
1. Verify `.env` file exists and has correct credentials
2. Check Supabase credentials at https://app.supabase.com
3. Ensure port 8080 is not in use: `netstat -ano | findstr :8080`

### Connection refused?
1. Verify SUPABASE_HOST is correct (should be `db.ktgzyufkalsipngqsayn.supabase.co`)
2. Check firewall allows connection to Supabase
3. Verify network connectivity: `ping db.ktgzyufkalsipngqsayn.supabase.co`

### Tests failing?
Run tests with: `.\mvnw.cmd test`
Tests use H2 in-memory database, not Supabase.

## Files Created/Modified

### Created
- `backend/.env` - Environment configuration
- `backend/.env.example` - Template for environment variables
- `backend/src/test/resources/application-test.yml` - Test configuration
- `backend/SUPABASE_SETUP.md` - Detailed setup guide
- `backend/QUICK_START.md` - Quick reference guide
- `backend/MAVEN_TROUBLESHOOTING.md` - Maven issue solutions
- `backend/build-helper.ps1` - Maven troubleshooting script
- `backend/run.cmd` - Batch startup script
- `backend/start.ps1` - PowerShell startup script

### Modified
- `backend/pom.xml` - Fixed dependencies, added H2
- `backend/src/test/java/com/boardinghub/app/AppApplicationTests.java` - Added test profile
- `backend/.mvn/wrapper/maven-wrapper.properties` - Updated mirror URL

## Next Steps

1. **Start the backend**
   ```powershell
   cd backend
   .\start.ps1
   ```

2. **Verify it's running**
   - Should see "Tomcat started on port(s): 8080"
   - Visit http://localhost:8080/auth/login (should return 405 - endpoint exists)

3. **Test with frontend**
   - Frontend should be configured to call http://localhost:8080
   - Update CORS if needed in `src/main/java/com/boardinghub/config/WebConfig.java`

4. **Database schema**
   - The `users` table is created automatically on first run
   - Subsequent runs use `ddl-auto: update` to migrate schema

## Database Schema

The application automatically creates/maintains the `users` table with:
- `id` - Primary key (auto-increment)
- `email` - Unique email address
- `password_hash` - Bcrypt hashed password
- `full_name` - User's full name
- `role` - LANDLORD or TENANT enum
- `created_at` - Timestamp

---

✅ **Backend is ready to launch!**