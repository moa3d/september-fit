FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ARG FIT_API_INTERNAL_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV FIT_API_INTERNAL_URL=${FIT_API_INTERNAL_URL}
COPY . .
RUN npm install
RUN npm run build -w @september-fit/customer-web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 3001
CMD ["npm", "run", "start", "-w", "@september-fit/customer-web"]
