FROM node:18-alpine
WORKDIR /app
COPY www ./www
COPY lib ./lib
COPY server.ts config.ts package.json package-lock.json ./
RUN npm ci --production
EXPOSE 3001
CMD ["ts-node", "server.ts"]