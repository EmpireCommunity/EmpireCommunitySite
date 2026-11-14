ARG NODE_IMAGE=node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8
# Member-count relay image (docs/contracts/deploy.md section 13, members-json 2.11). Build context: deploy/members-source.
# The official Node base (major of .nvmrc, Alpine, by digest, the same as the site Dockerfile) plus the one script:
# no package install, no node_modules, no other file. busybox wget stays in the base for the compose healthcheck.
# No traefik.* label here: routing labels live only in compose.yml.
FROM ${NODE_IMAGE}
COPY relay.mjs /opt/members-source/relay.mjs
USER node
EXPOSE 8080
CMD ["node", "/opt/members-source/relay.mjs"]
