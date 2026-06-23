# Build the docker image with `npx nx docker-build api` or `docker compose build api`.
# Run the full local operations stack with `docker compose up --build`.

FROM docker.io/node:lts-alpine AS build

WORKDIR /workspace

RUN apk add --no-cache openssl

COPY package.json package-lock.json nx.json project.json ./
COPY tsconfig.json tsconfig.app.json ./
COPY src ./src

RUN npm ci
RUN npx prisma generate --schema src/prisma/schema.prisma
RUN npx nx build api --configuration=production --skip-nx-cache

FROM docker.io/node:lts-alpine

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache openssl && \
    addgroup --system api && \
    adduser --system -G api api

COPY --from=build /workspace/dist/api api
COPY --from=build /workspace/src/prisma/schema.prisma api/src/prisma/schema.prisma
COPY --from=build /workspace/src/prisma/migrations api/src/prisma/migrations

RUN npm --prefix api --omit=dev --force install && \
    npm --prefix api --omit=dev --force install prisma@4.16.2 && \
    cd api && ./node_modules/.bin/prisma generate --schema src/prisma/schema.prisma && \
    chown -R api:api /app

USER api

CMD ["sh", "-c", "cd api && ./node_modules/.bin/prisma migrate deploy --schema src/prisma/schema.prisma && node ."]
