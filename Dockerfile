FROM node:20-alpine AS build

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Download stock video for CAC section (Mixkit free license)
RUN wget -q -O /usr/share/nginx/html/cac-bg.mp4 "https://assets.mixkit.co/videos/42664/42664-720.mp4"

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/50x.html

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- --no-check-certificate https://127.0.0.1:443/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
