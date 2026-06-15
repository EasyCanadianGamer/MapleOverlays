FROM node:22-alpine AS build
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
RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/frontend/ ./apps/frontend/

ARG VITE_TWITCH_CLIENT_ID
ARG VITE_TWITCH_REDIRECT_URI
ARG VITE_API_URL
ENV VITE_DOC_URL
ENV VITE_TWITCH_CLIENT_ID=$VITE_TWITCH_CLIENT_ID
ENV VITE_TWITCH_REDIRECT_URI=$VITE_TWITCH_REDIRECT_URI
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DOC_URL=$VITE_DOC_URL

RUN pnpm --filter @maple/frontend build

FROM nginx:alpine
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
