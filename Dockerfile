##########################
FROM node:24.13.0-alpine3.23 AS base

WORKDIR /app
ENV NODE_ENV=production

##########################
FROM base AS deps

RUN apk add --no-cache python3 make g++ git
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund

##########################
FROM alpine:3.19 AS fonts

RUN apk add --no-cache wget unzip
RUN mkdir -p /app/fonts && \
    wget -q https://github.com/openmaptiles/fonts/releases/download/v2.0/v2.0.zip -O /tmp/fonts.zip && \
    unzip -q /tmp/fonts.zip -d /app/fonts && \
    rm /tmp/fonts.zip

##########################
FROM base AS main

COPY --from=deps /app/node_modules node_modules
COPY --from=fonts /app/fonts /app/fonts
COPY src src
COPY package.json README.md* LICENSE ./

EXPOSE 8080
EXPOSE 9090

USER node

CMD ["node", "src/index.ts"]
