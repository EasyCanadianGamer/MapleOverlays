FROM node:20-alpine
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/lastfm/package.json ./packages/lastfm/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --prod

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

EXPOSE 3000
CMD ["node", "apps/api/src/index.js"]
