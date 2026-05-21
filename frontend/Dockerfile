FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app code
COPY . .

# Build Next.js
RUN npm run build

# Expose Next.js port
EXPOSE 3000

CMD ["npm", "start"]