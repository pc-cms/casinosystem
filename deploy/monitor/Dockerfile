FROM node:20-alpine
RUN apk add --no-cache docker-cli curl procps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
CMD ["node", "index.js"]
