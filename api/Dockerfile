# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy go files and download dependencies
COPY go.mod go.sum ./
RUN GOPROXY=https://goproxy.cn,direct go mod download

# Copy source code
COPY . .

# Tidy modules to ensure go.sum is complete
RUN GOPROXY=https://goproxy.cn,direct go mod tidy

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -installsuffix cgo -o api ./cmd/api

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/api .
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/internal/config ./internal/config

EXPOSE 6001

ENV PORT=6001

CMD ["./api"]