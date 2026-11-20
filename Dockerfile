FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
ENV VITE_AUTH_ENABLED=false
ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV NITRO_HOST=0.0.0.0
ENV HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
