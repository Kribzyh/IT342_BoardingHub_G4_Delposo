# BoardingHub Backend Setup Guide

## Prerequisites
- Java 17 or higher
- Maven (or use the included Maven wrapper)
- Supabase account (https://supabase.com)

## Setup Steps

### 1. Clone or Download the Project
Ensure you have the backend folder with the source code.

### 2. Create Supabase Project
1. Go to https://supabase.com and create a new project
2. Wait for the project to be fully provisioned
3. Go to Settings → Database to get your connection details
4. **Important:** Use the Session Pooler connection string for better connection management

### 3. Configure Environment Variables
Create a `.env` file in the `backend/` directory with your Supabase session pooler credentials:

```bash
# Supabase PostgreSQL Session Pooler Connection
SUPABASE_HOST=db.your-project-id.supabase.co
SUPABASE_PORT=5432
SUPABASE_DB=postgres
SUPABASE_USER=postgres.your-project-id
SUPABASE_PASSWORD=your-session-pooler-password
JWT_SECRET=your-secure-jwt-secret-at-least-32-characters-long
```

**Important:**
- Use the **Session Pooler** connection details from your Supabase project settings (Settings → Database → Connection Pooling)
- The host will be in the format `db.your-project-id.supabase.co`
- The username will be `postgres.your-project-id`
- Use the session pooler password (different from the main database password)
- Create a strong JWT secret (minimum 32 characters)

### 4. Build the Application
```bash
cd backend
./mvnw clean install
```

### 5. Run the Application
Use the enhanced startup script which includes DNS validation and JVM options:
```bash
./start.ps1
```

Or manually with JVM options for DNS resolution:
```bash
./mvnw spring-boot:run -Djava.net.preferIPv4Stack=false -Djava.net.preferIPv6Addresses=true
```

The application will start on http://localhost:8080

### 6. Verify Setup
- Check the console for successful database connection logs
- The app will automatically create the `users` table on first run via Hibernate
- Test the endpoints using a tool like Postman or curl

## API Endpoints
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- Other endpoints as implemented

## Troubleshooting
- **Connection failed**: Verify your `.env` credentials are correct and using session pooler details
- **DNS resolution issues**: The startup script includes JVM options for IPv6 preference; if issues persist, check network connectivity
- **Build errors**: Ensure Java 17+ is installed
- **Port issues**: Make sure port 8080 is available; the script will report if the port is in use
- **Session pooler connection**: Ensure you're using the session pooler credentials, not the direct database credentials

## Security Notes
- Never commit the `.env` file to version control
- Use strong passwords and JWT secrets
- Keep your Supabase project secure
- Session pooler provides connection pooling and better scalability

## Additional Notes
- The application uses HikariCP connection pooling with optimized settings
- Database schema is managed via Hibernate (auto-create/update)
- JWT authentication is implemented for secure API access