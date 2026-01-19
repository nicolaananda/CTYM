# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
# Copy source files first
COPY . .
# Install dependencies (this will create node_modules with correct permissions)
RUN npm ci
# Build the app to dist folder
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
