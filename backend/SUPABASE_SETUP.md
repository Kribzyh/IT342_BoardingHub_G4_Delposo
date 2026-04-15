# BoardingHub Backend - Supabase Setup Guide

## Overview
This Spring Boot application uses Supabase (PostgreSQL) as its database. Supabase provides a hosted PostgreSQL database with built-in authentication and real-time capabilities.

## Prerequisites
- Supabase account (https://supabase.com)
- A Supabase project created
- Java 17 or higher
- Maven

## Supabase Configuration

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. You'll find:
   - **Host**: `[project-id].supabase.co`
   - **Database**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: Your database password (set during project creation)

### Step 2: Create .env File

Create a `.env` file in the `backend/` directory with your Supabase credentials:

```bash
SUPABASE_HOST=your-project-id.supabase.co
SUPABASE_PORT=5432
SUPABASE_DB=postgres
SUPABASE_USER=postgres
SUPABASE_PASSWORD=your-database-password
JWT_SECRET=your-secret-key-minimum-32-characters-long-for-hs256
```

**Important:** 
- Replace `your-project-id` with your actual Supabase project ID
- Replace `your-database-password` with your actual database password
- The `JWT_SECRET` should be a strong, random string of at least 32 characters
- Never commit `.env` file to version control - add it to `.gitignore`

### Step 3: Build and Run

```bash
cd backend
./mvnw clean install
./mvnw spring-boot:run
```

The application will automatically create the `users` table on first run (configured with `hibernate.ddl-auto: update`).

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_HOST` | Supabase database host | `my-project.supabase.co` |
| `SUPABASE_PORT` | PostgreSQL port | `5432` |
| `SUPABASE_DB` | Database name | `postgres` |
| `SUPABASE_USER` | Database user | `postgres` |
| `SUPABASE_PASSWORD` | Database password | `abc123xyz` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `my-super-secret-key-...` |

## Connection Details

The application uses:
- **Driver**: PostgreSQL JDBC Driver
- **SSL Mode**: Required (`sslmode=require`)
- **Hibernate Dialect**: PostgreSQL
- **Auto DDL**: Update mode (creates/updates tables automatically)

## Troubleshooting

### Connection Refused
- Verify your Supabase host is correct
- Check if port 5432 is accessible from your location
- Verify database password is correct

### SSL Certificate Error
- The connection string includes `sslmode=require` which enforces SSL
- This is secure but may fail if your environment has certificate issues
- Change to `sslmode=prefer` if needed (less secure)

### Authentication Error
- Check that `SUPABASE_USER` and `SUPABASE_PASSWORD` are correct
- Verify you're using the PostgreSQL credentials, not the Supabase API credentials

## Verifying the Connection

Once running, check the logs:

```
2024-03-11 10:00:00,000 INFO [main] org.hibernate.dialect.Dialect : HHH000400: Using dialect: org.hibernate.dialect.PostgreSQLDialect
```

If you see successful Hibernate initialization, your connection is working!

## Next Steps

1. Register a new user via `POST /auth/register`
2. Login via `POST /auth/login`
3. Use the returned JWT token in the `Authorization: Bearer <token>` header for authenticated requests

## Support

- Supabase Documentation: https://supabase.com/docs
- Spring Boot Documentation: https://spring.io/projects/spring-boot
- Spring Data JPA: https://spring.io/projects/spring-data-jpa
