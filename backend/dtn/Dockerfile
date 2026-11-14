# dtn7-rs BPv7 daemon (dtnd) and its CLI tools
FROM rust:1.83-slim-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev build-essential && rm -rf /var/lib/apt/lists/*
RUN cargo install dtn7 --version 0.21.0 --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl iproute2 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/cargo/bin/ /usr/local/bin/
