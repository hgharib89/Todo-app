# Diwaniya Kout game server (Colyseus). Build from the kout/ folder:  fly deploy   (or: docker build -t kout-server .)
# The server is bundled into ONE file with the shared game engine (src/engine + rules.config.ts).

FROM node:22.11.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY server ./server
RUN npm run server:build

FROM node:22.11.0-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=2567
COPY --from=build /app/server/dist/index.cjs ./index.cjs
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:2567/healthz || exit 1
CMD ["node", "index.cjs"]
