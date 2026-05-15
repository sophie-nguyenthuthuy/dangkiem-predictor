# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile=false

# ---- build ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @dangkiem/api prisma generate
RUN pnpm --filter @dangkiem/api build

# ---- runtime ----
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/packages/shared ./node_modules/@dangkiem/shared
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps_node_modules

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
