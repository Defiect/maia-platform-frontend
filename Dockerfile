# syntax=docker/dockerfile:1

# ══════════════════════════════════════════════════════════════════════════════
# Private LAN Maia instance
#   target "web"    — Next.js standalone app (container port 3000)
#   target "engine" — engine sidecar: native Stockfish dev + Maia ONNX w/ CUDA
# ══════════════════════════════════════════════════════════════════════════════

# ── web: dependencies ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS web-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── web: build ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS web-build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=web-deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── web: runtime ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=web-build /app/.next/standalone ./
COPY --from=web-build /app/public ./public
COPY --from=web-build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

# ── engine: build Stockfish dev from master ───────────────────────────────────
FROM debian:bookworm-slim AS sf-build
ARG SF_ARCH=x86-64-avx2
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/official-stockfish/Stockfish.git /stockfish
WORKDIR /stockfish/src
RUN make -j"$(nproc)" build ARCH="${SF_ARCH}" \
    && strip stockfish

# ── engine: runtime (CUDA 13 + cuDNN 9 for onnxruntime-node GPU EP) ───────────
FROM nvidia/cuda:13.0.3-cudnn-runtime-ubuntu24.04 AS engine
WORKDIR /srv/engine
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
COPY engine-server/package.json ./
# --onnxruntime-node-install-cuda downloads the CUDA execution provider
# binaries; the service falls back to CPU at runtime if CUDA is unusable.
RUN npm install --omit=dev --onnxruntime-node-install-cuda
COPY engine-server/server.js ./
COPY --from=sf-build /stockfish/src/stockfish /usr/local/bin/stockfish
COPY public/maia3/maia3_simplified.onnx ./models/maia3_simplified.onnx
ENV PORT=3001 \
    STOCKFISH_PATH=/usr/local/bin/stockfish \
    MAIA_MODEL_PATH=/srv/engine/models/maia3_simplified.onnx
EXPOSE 3001
CMD ["node", "server.js"]
