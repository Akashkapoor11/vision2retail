FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_API_FALLBACK_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_API_FALLBACK_URL=${NEXT_PUBLIC_API_FALLBACK_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S webgroup && adduser -S webuser -G webgroup
# output: standalone must be run via its generated server.js, not `next start`.
COPY --from=builder --chown=webuser:webgroup /app/.next/standalone ./
COPY --from=builder --chown=webuser:webgroup /app/.next/static ./.next/static
COPY --from=builder --chown=webuser:webgroup /app/public ./public
USER webuser
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/ > /dev/null || exit 1
CMD ["node", "server.js"]
