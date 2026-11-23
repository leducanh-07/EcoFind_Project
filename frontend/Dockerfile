# =============================================================================
# EcoFind Frontend Dockerfile (Vite + React 18 + Tailwind CSS -> Nginx)
# Task TE9C75A (DevOps / Triển khai)
# =============================================================================

# Stage 1: Build production assets
FROM node:20-alpine AS build

WORKDIR /app

# Cài đặt dependencies
COPY package*.json ./
RUN npm ci || npm install

# Sao chép mã nguồn và thực hiện build Vite production
COPY . .
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Stage 2: Serve tĩnh qua máy chủ Nginx hiệu năng cao
FROM nginx:alpine

# Sao chép tệp build từ Stage 1 sang thư mục web root của Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Sao chép cấu hình Nginx tối ưu cho SPA và reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cổng lắng nghe HTTP
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
