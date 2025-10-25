FROM node:alpine3.22 AS base
WORKDIR /app

FROM base AS dev
COPY package.json .
RUN npm install --include=dev

FROM base AS prod
COPY package.json .
COPY src ./src
RUN npm install