# ![Node/Express/Prisma Example App](project-logo.png)

[![Build Status](https://travis-ci.org/anishkny/node-express-realworld-example-app.svg?branch=master)](https://travis-ci.org/anishkny/node-express-realworld-example-app)

> ### Example Node (Express + Prisma) codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the [RealWorld](https://github.com/gothinkster/realworld-example-apps) API spec.

## Current stack

- TypeScript 5.2 with strict app builds.
- Express 5.2, Prisma 4/PostgreSQL, Nx, Jest, Supertest, Playwright, and StrykerJS.
- Docker Compose for the API, PostgreSQL, Loki, Grafana, Tempo, and Mimir.
- OpenAPI contract in `src/docs/openapi.json`.

Governance note for audit fix `#20`: all new repository changes must be tracked
by a GitHub Issue before work starts and every commit must reference that issue.
The versioned `.githooks/commit-msg` hook enforces the `#<id>` reference when
`git config core.hooksPath .githooks` is active.

<a href="https://thinkster.io/tutorials/node-json-api" target="_blank"><img width="454" src="https://raw.githubusercontent.com/gothinkster/realworld/master/media/learn-btn-hr.png" /></a>

## Getting Started

### Prerequisites

Run the following command to install dependencies:

```shell
npm install
```

### Environment variables

This project depends on some environment variables.
If you are running this project locally, create a `.env` file at the root for these variables.
Your host provider should included a feature to set them there directly to avoid exposing them.

Here are the required ones:

```
DATABASE_URL=
JWT_SECRET=
NODE_ENV=production
```

### Generate your Prisma client

Run the following command to generate the Prisma Client which will include types based on your database schema:

```shell
npx prisma generate
```

### Apply any SQL migration script

Run the following command to create/update your database based on existing sql migration scripts:

```shell
npx prisma migrate deploy
```

### Run the project

Run the following command to run the project:

```shell
npx nx serve api
```

### Test and quality gates

```shell
npx nx build api --skip-nx-cache
npx nx test api --runInBand --skip-nx-cache
npx nx run api:integration-test --skip-nx-cache
npm run e2e:api
npm run mutation
```

The integration and Playwright gates require Docker because they start a
PostgreSQL test container. The mutation gate is configured to fail below a 95%
mutation score.

### Docker and observability validation

Run the local operations stack:

```shell
docker compose up --build
```

Validate startup/shutdown logs, per-endpoint request counters, and traces:

```shell
python scripts/validate-stack.py --compose-file docker-compose.yml --timeout 120
```

If host port `3000` is already in use, choose another host port for the API:

```shell
API_PORT=3010 API_BASE_URL=http://127.0.0.1:3010 python scripts/validate-stack.py --compose-file docker-compose.yml --timeout 120
```

### Seed the database

The project includes a seed script to populate the database:

```shell
npx prisma db seed
```

## Deploy on a remote server

Run the following command to:

- install dependencies
- apply any new migration sql scripts
- run the server

```shell
npm ci && npx prisma migrate deploy && node dist/api/main.js
```
