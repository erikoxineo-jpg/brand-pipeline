FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Baixar video de fundo (licenca Mixkit gratuita)
RUN wget -q -O /usr/share/nginx/html/cac-bg.mp4 "https://assets.mixkit.co/videos/42664/42664-720.mp4"

# Remover assets padrao do nginx e esconder versao do servidor
RUN rm -rf /usr/share/nginx/html/50x.html && \
    sed -i '/http {/a\    server_tokens off;' /etc/nginx/nginx.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- --no-check-certificate https://127.0.0.1:443/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
