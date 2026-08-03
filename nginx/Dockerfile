# Multi-stage build: build both React frontends, then serve them + reverse
# proxy the API with a single nginx image.

FROM node:20-alpine AS build-admin
WORKDIR /app/admin
COPY frontend/admin/package*.json ./
RUN npm install
COPY frontend/admin/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM node:20-alpine AS build-pwa
WORKDIR /app/pwa
COPY frontend/pwa/package*.json ./
RUN npm install
COPY frontend/pwa/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-admin /app/admin/dist /usr/share/nginx/html/admin
COPY --from=build-pwa /app/pwa/dist /usr/share/nginx/html/pwa

EXPOSE 80 81
