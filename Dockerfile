# When you run docker build -t my-app, Docker looks for a file named Dockerfile in the current directory (.) and executes the instructions in the file sequentially to build your image. 

# Use an official Node.js runtime as a parent image
# FROM: Specifies the base image to use for the container.
# node:18: Pulls the official Node.js Docker image with version 18. This image comes with Node.js and NPM pre-installed.
FROM node:18

# Set the working directory inside the container
# WORKDIR: Sets the current working directory inside the container to /usr/src/app.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (to cache dependencies)
# If you copy everything at once (COPY . .), Docker will invalidate the cache every time you change a single file in your app, and npm install will run unnecessarily.
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Set the PORT environment variable and start the application
ENV PORT=3000
# -H 0.0.0.0 is necessary for Next.js binds to all network interfaces, allowing traffic to flow between the host machine and the container.
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
