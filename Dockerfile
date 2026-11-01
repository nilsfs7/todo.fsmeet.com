FROM node:26.13.0 AS build

ARG NEXT_PUBLIC_SITE_URL=https://dev.todo.fsmeet.dffb.org
ARG FSMEET_API_URL=https://api.dev.fsmeet.dffb.org/v1
ARG FSMEET_OAUTH_CLIENT_ID=todo

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV FSMEET_API_URL=$FSMEET_API_URL
ENV FSMEET_OAUTH_CLIENT_ID=$FSMEET_OAUTH_CLIENT_ID

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26.13.0

ARG NEXT_PUBLIC_SITE_URL=https://dev.todo.fsmeet.dffb.org
ARG FSMEET_API_URL=https://api.dev.fsmeet.dffb.org/v1
ARG FSMEET_OAUTH_CLIENT_ID=todo
ARG NODE_ENV=development

ENV NODE_ENV=$NODE_ENV
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV FSMEET_API_URL=$FSMEET_API_URL
ENV FSMEET_OAUTH_CLIENT_ID=$FSMEET_OAUTH_CLIENT_ID

USER node
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts

EXPOSE 3003

CMD ["npm", "start"]
