FROM node:22-alpine

WORKDIR /app

# Copy dependency files first (cached layer)
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy app code
COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
