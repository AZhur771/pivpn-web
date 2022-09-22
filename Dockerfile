FROM node:14-alpine
WORKDIR /app
COPY www ./www
COPY services ./services
COPY lib ./lib
COPY server.js config.js package.json package-lock.json ./
RUN npm ci --production
EXPOSE 3001
CMD ["node", "server.js"]