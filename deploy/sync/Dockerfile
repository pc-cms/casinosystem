FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js api.js ./
EXPOSE 8787
USER node
CMD ["node", "index.js"]
