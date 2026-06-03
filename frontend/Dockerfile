FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine

ENV BACKEND_HOST=open_fire_backend
ENV BACKEND_CONTAINER_PORT=8080

COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/open-fire/browser /usr/share/nginx/html

EXPOSE 80
