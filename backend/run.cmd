@echo off
REM Set environment variables from .env file
set SUPABASE_HOST=db.ktgzyufkalsipngqsayn.supabase.co
set SUPABASE_PORT=5432
set SUPABASE_DB=postgres
set SUPABASE_USER=postgres
set SUPABASE_PASSWORD=BoardingHUB14637
set JWT_SECRET=BoardingHub2024SecretKeyWithAtLeast32CharactersLongForHS256!!!

REM Run the application
echo Starting BoardingHub Backend...
echo.
echo Database: %SUPABASE_HOST%
echo Port: 8080
echo.
java -jar target/app-0.0.1-SNAPSHOT.jar
