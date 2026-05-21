# Build stage
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Runtime stage
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache tini

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "dist/server.js"]
