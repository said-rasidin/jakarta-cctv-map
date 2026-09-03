FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY scripts/copy-ort-assets.mjs ./scripts/copy-ort-assets.mjs
RUN npm ci

FROM python:3.12-slim AS ai-model
WORKDIR /app
ARG AI_MODEL_VARIANT=all
ARG AI_MODEL_PRECISION=fp16
ARG AI_MODEL_IMAGE_SIZE=416
ENV AI_MODEL_VARIANT=${AI_MODEL_VARIANT}
ENV AI_MODEL_PRECISION=${AI_MODEL_PRECISION}
ENV AI_MODEL_IMAGE_SIZE=${AI_MODEL_IMAGE_SIZE}
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1
COPY requirements-ai.txt ./
RUN python -m pip install -r requirements-ai.txt
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libxcb1 libxext6 && rm -rf /var/lib/apt/lists/*
COPY scripts/export-yolo26n.py ./scripts/export-yolo26n.py
RUN python scripts/export-yolo26n.py

FROM base AS development
ARG NEXT_PUBLIC_ENABLE_CCTV_AI=true
ENV NEXT_PUBLIC_ENABLE_CCTV_AI=${NEXT_PUBLIC_ENABLE_CCTV_AI}
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/public/ort ./public/ort
COPY . .
COPY --from=ai-model /app/public/models/yolo26n ./public/models/yolo26n
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM development AS builder
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
