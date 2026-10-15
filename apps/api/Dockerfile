FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/fit-engine/package.json packages/fit-engine/package.json
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build -w @september-fit/fit-engine
RUN npm run build -w @september-fit/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=build /app/packages/fit-engine/dist ./packages/fit-engine/dist
COPY --from=build /app/packages/fit-engine/package.json ./packages/fit-engine/package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY apps/api/docker-entrypoint.sh /usr/local/bin/september-fit-entrypoint
RUN chmod +x /usr/local/bin/september-fit-entrypoint
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/september-fit-entrypoint"]
CMD ["node", "apps/api/dist/main.js"]
