# Build stage
FROM oven/bun:1-alpine AS build
WORKDIR /app

# Accept build args for environment variables
ARG VITE_API_BASE_URL
ARG VITE_TELEGRAM_BOT_USERNAME
ARG VITE_APP_URL
ARG GIT_COMMIT_SHA=unknown

# Set environment variables for build
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_TELEGRAM_BOT_USERNAME=${VITE_TELEGRAM_BOT_USERNAME}
ENV VITE_APP_URL=${VITE_APP_URL}
ENV VITE_GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Runtime stage - use Bun to serve static files
FROM oven/bun:1-alpine
WORKDIR /app

# Copy built assets from build stage
COPY --from=build /app/dist ./dist

# Create a simple static file server
RUN echo 'Bun.serve({ port: 3000, fetch(req) { return new Response(Bun.file("dist" + new URL(req.url).pathname === "dist/" ? "dist/index.html" : "dist" + new URL(req.url).pathname)); } });' > /tmp/server.ts

# Better static server with SPA support
COPY <<'EOF' server.ts
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Default to index.html for root
    if (path === '/') {
      path = '/index.html';
    }

    const filePath = `dist${path}`;
    const file = Bun.file(filePath);

    // Check if file exists
    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback - return index.html for client-side routing
    return new Response(Bun.file('dist/index.html'));
  },
});

console.log(`Server running at http://localhost:${server.port}`);
EOF

EXPOSE 3000

CMD ["bun", "run", "server.ts"]
