# Site image: static files in nginx-unprivileged (docs/adr/0001-stack.md section 3, docs/contracts/deploy.md section 4).
# Both base images are pinned by digest; Dependabot (docker ecosystem) keeps them current.
ARG NODE_IMAGE=node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30-alpine-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6

# ---- build: dist/ is built and checked here, so the files that ship are the files that were checked ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm comes from "packageManager" in package.json; installs use the lockfile only.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build \
 && node scripts/check-dist.ts \
 && find dist -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' -o -name '*.xml' \
      -o -name '*.txt' -o -name '*.json' -o -name '*.webmanifest' \) -exec gzip -9 -k -n {} +

# ---- runtime: dist/ and the nginx configuration only. No src/, no data files, no Node ----
FROM ${NGINX_IMAGE} AS runtime
ARG VERSION=dev
ARG REVISION=unknown
# OCI labels only. Routing labels (traefik.*) live in deploy/compose.yml and never in an image.
LABEL org.opencontainers.image.title="EmpireCommunitySite" \
      org.opencontainers.image.source="https://github.com/EmpireCommunity/EmpireCommunitySite" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
USER root
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/snippets/ /etc/nginx/snippets/
COPY --from=build /app/dist/ /usr/share/nginx/html/
RUN find /usr/share/nginx/html /etc/nginx/conf.d /etc/nginx/snippets -type d -exec chmod 755 {} + \
 && find /usr/share/nginx/html /etc/nginx/conf.d /etc/nginx/snippets -type f -exec chmod 644 {} + \
 && chmod 644 /etc/nginx/nginx.conf
USER 101
EXPOSE 8080
