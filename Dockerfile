# When you run docker build -t my-app, Docker looks for a file named Dockerfile in the current directory (.) and executes the instructions in the file sequentially to build your image. 

# Use an official Node.js runtime as a parent image
# FROM: Specifies the base image to use for the container.
# node:18: Pulls the official Node.js Docker image with version 18. This image comes with Node.js and NPM pre-installed.
FROM node:18-slim

# Install necessary dependencies for LibreOffice and other potential needs
# Combining the RUN instructions is generally better
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-base \
    libreoffice-common \
    fonts-freefont-ttf

# Set the working directory inside the container
# WORKDIR: Sets the current working directory inside the container to /usr/src/app.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (to cache dependencies)
# If you copy everything at once (COPY . .), Docker will invalidate the cache every time you change a single file in your app, and npm install will run unnecessarily.
COPY package*.json ./

# Install app dependencies
RUN npm install --frozen-lockfile

# Copy the rest of your application code
COPY . .

# Build your Next.js application for production (even for local testing, this is a good practice)
RUN npm run build

# Expose the port your app runs on
EXPOSE 3000

# Set the PORT environment variable and start the application
ENV PORT=3000

# Command to start your Next.js application in production mode
# We'll use 'start' instead of 'dev' for a more production-like local test
CMD ["npm", "start"]
