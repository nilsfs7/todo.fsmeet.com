FROM node:26.13.0 AS build

ARG AUTH_URL=https://dev.todo.fsmeet.dffb.org
ARG BACKEND_URL_FSMEET=https://api.dev.fsmeet.dffb.org
ARG FRONTEND_URL_FSMEET=https://dev.fsmeet.dffb.org
ARG BUILD_TIME=""
ARG FSMEET_OAUTH_CLIENT_ID=todo

ENV NEXT_PUBLIC_SITE_URL=$AUTH_URL
ENV NEXT_PUBLIC_FSMEET_API_URL=${BACKEND_URL_FSMEET}/v1
ENV NEXT_PUBLIC_FSMEET_FRONTEND_URL=$FRONTEND_URL_FSMEET
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
ENV AUTH_URL=$AUTH_URL
ENV BACKEND_URL_FSMEET=$BACKEND_URL_FSMEET
ENV FRONTEND_URL_FSMEET=$FRONTEND_URL_FSMEET
ENV FSMEET_OAUTH_CLIENT_ID=$FSMEET_OAUTH_CLIENT_ID

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26.13.0

ARG AUTH_URL=https://dev.todo.fsmeet.dffb.org
ARG BACKEND_URL_FSMEET=https://api.dev.fsmeet.dffb.org
ARG FRONTEND_URL_FSMEET=https://dev.fsmeet.dffb.org
ARG BUILD_TIME=""
ARG FSMEET_OAUTH_CLIENT_ID=todo

ENV NEXT_PUBLIC_SITE_URL=$AUTH_URL
ENV NEXT_PUBLIC_FSMEET_API_URL=${BACKEND_URL_FSMEET}/v1
ENV NEXT_PUBLIC_FSMEET_FRONTEND_URL=$FRONTEND_URL_FSMEET
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
ENV AUTH_URL=$AUTH_URL
ENV BACKEND_URL_FSMEET=$BACKEND_URL_FSMEET
ENV FRONTEND_URL_FSMEET=$FRONTEND_URL_FSMEET
ENV FSMEET_OAUTH_CLIENT_ID=$FSMEET_OAUTH_CLIENT_ID

ENV PORT=3004
ENV NODE_ENV=production

USER node
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts

EXPOSE 3003

CMD ["npm", "start"]
