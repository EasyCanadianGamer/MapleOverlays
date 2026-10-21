FROM node:22-alpine
RUN npm install -g pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/lastfm/package.json ./packages/lastfm/
COPY packages/shared/package.json ./packages/shared/
COPY docs/public/package.json ./docs/public/
COPY pnpm-lock.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

COPY packages/ ./packages/
COPY apps/bot/ ./apps/bot/

CMD ["node", "apps/bot/src/index.js"]
