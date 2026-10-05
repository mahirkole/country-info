# country-info: one image for the API (`serve`) and the update cycle (`scripts/cron/run-cycle.sh`).
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
# dev dependencies stay: the CLI runs TypeScript through tsx (no build step)
COPY package.json package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY data ./data
COPY scripts ./scripts
RUN mkdir -p .cache out publish && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm run -s migrate && exec npm run -s serve"]
