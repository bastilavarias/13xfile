FROM golang:1.24-alpine AS build
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/13xfile-feed-api .

FROM alpine:3.21
RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build /out/13xfile-feed-api /usr/local/bin/13xfile-feed-api
RUN mkdir -p /data && chown -R app:app /data
USER app
ENV ADDR=:8090
ENV DATABASE_PATH=/data/feed.db
EXPOSE 8090
ENTRYPOINT ["/usr/local/bin/13xfile-feed-api"]
