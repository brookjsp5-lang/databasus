# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9 && \
    pnpm install --registry https://registry.npmmirror.com

COPY . .

RUN pnpm build

# Final stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]