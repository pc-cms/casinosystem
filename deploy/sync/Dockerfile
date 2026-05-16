FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js api.js pair-cli.js ./
EXPOSE 8787
# Run as root so the admin API can read/write the root-owned /compose/.env
# (deploy/.env is chmod 600 root:root by install.sh — needed for updater flags
# CHECK_NOW / PUSH_COMMAND.json and version bumps via writeEnvKey()).
CMD ["node", "index.js"]
