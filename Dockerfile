FROM node:18-bullseye

WORKDIR /usr/src/app

# Install dependencies (including dev deps for `npm run dev` / nodemon)
COPY package*.json ./
RUN npm ci

# Copy project files
COPY . .

EXPOSE 3000

# Default dev command (overridden by docker-compose if needed)
CMD ["npm", "run", "dev"]
