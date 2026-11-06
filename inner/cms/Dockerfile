FROM node:22-alpine
# Pinned (not @latest) so behavior changes between pnpm versions can't silently break the build.
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm applies patches/ during install (patchedDependencies in pnpm-workspace.yaml).
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
# next build sets NODE_ENV=production, which disables push:true in payload.config.ts
RUN pnpm build
EXPOSE 3000
# Apply any pending migrations before starting the production server.
CMD ["sh", "-c", "pnpm payload migrate && pnpm start"]
