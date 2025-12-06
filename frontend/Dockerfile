# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/ ./
# If no package.json exists, these will be no-ops; keep for future builds
RUN if [ -f package.json ]; then npm install --ignore-scripts; fi
RUN if [ -f package.json ]; then npm run build || true; fi

FROM nginx:1.25-alpine AS runtime
WORKDIR /usr/share/nginx/html
COPY frontend/ /usr/share/nginx/html
# Prefer built assets if present
COPY --from=build /app/dist/ /usr/share/nginx/html/ 2>/dev/null || true
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
