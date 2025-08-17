# Use an official Node.js image. Alpine is lightweight.
FROM node:20-alpine

# Set the working directory inside the container to /app
WORKDIR /app

# Copy package.json and package-lock.json to the container
# This is done separately to take advantage of Docker's layer caching.
COPY package.json package-lock.json ./

# Install all project dependencies
RUN npm install

# Copy the rest of your frontend source code into the container
COPY . .

# Tell Docker that the container will listen on port 5173
EXPOSE 5173

# This is the command that starts the Vite development server
CMD ["npm", "run", "dev"]