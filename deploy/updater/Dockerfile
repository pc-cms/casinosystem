FROM node:20-alpine
RUN apk add --no-cache docker-cli docker-cli-compose curl rsync tar postgresql15-client bash
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
CMD ["node", "index.js"]
