#!/bin/sh

echo "⏳ Waiting for SQL Server at $SQL_HOST:$SQL_PORT..."

until /opt/mssql-tools/bin/sqlcmd -S "$SQL_HOST,$SQL_PORT" -U "$SQL_USER" -P "$SQL_PASSWORD" -Q "SELECT 1" > /dev/null 2>&1; do
  echo "❌ SQL Server not ready yet..."
  sleep 2
done

echo "✅ SQL Server is up - executing migration and starting server"

npx prisma migrate deploy
node server.js
