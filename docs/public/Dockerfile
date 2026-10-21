FROM node:22-alpine AS build
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/lastfm/package.json ./packages/lastfm/
COPY packages/shared/package.json ./packages/shared/
COPY docs/public/package.json ./docs/public/
COPY pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY docs/public/ ./docs/public/

RUN pnpm --filter @maple/docs build

FROM nginx:alpine
COPY --from=build /app/docs/public/dist /usr/share/nginx/html
COPY docs/public/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
