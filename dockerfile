FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .

# Create volume for logs
VOLUME /app/logs

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
