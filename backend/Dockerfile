# Use Node base image (Debian-based)
FROM node:20

# Install required tools for SQL Server client AND Python environment
# We install numpy and scipy directly from the Debian repositories to avoid conflicts.
RUN apt-get update && \
    apt-get install -y curl gnupg unixodbc-dev python3 python3-pip python3-numpy python3-scipy && \
    mkdir -p /etc/apt/keyrings && \
    curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /etc/apt/keyrings/microsoft.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 mssql-tools && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add mssql tools to PATH
ENV PATH="$PATH:/opt/mssql-tools/bin"

# Set working directory
WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm install

# --- Install remaining Python dependencies ---
# Pandas is often best installed via pip to get a recent version.
# We use the --break-system-packages flag as a targeted override just for this,
# which is an accepted practice for packages not in the main apt repositories.
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy the rest of the app
COPY . .

# Make the wait script executable
RUN chmod +x wait-for-sql.sh

# Generate Prisma Client
RUN npx prisma generate

# Expose backend port
EXPOSE 5000

# Start the backend only after SQL Server is ready
CMD ["./wait-for-sql.sh", "node", "server.js"]

