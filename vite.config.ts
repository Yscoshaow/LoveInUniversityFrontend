import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import { execSync } from 'child_process';

// Get git commit SHA
function getGitCommitSha(): string {
  // First check environment variable (used in Docker builds)
  if (process.env.VITE_GIT_COMMIT_SHA && process.env.VITE_GIT_COMMIT_SHA !== 'unknown') {
    return process.env.VITE_GIT_COMMIT_SHA;
  }
  // Fall back to git command
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

// Get version from package.json
function getVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const version = getVersion();
    const commitSha = getGitCommitSha();

    return {
      server: fs.existsSync('localhost+2-key.pem') ? {
        https: {
          key: fs.readFileSync('localhost+2-key.pem'),
          cert: fs.readFileSync('localhost+2.pem')
        }
      } : undefined,
      plugins: [tailwindcss(), react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__APP_VERSION__': JSON.stringify(version),
        '__GIT_COMMIT_SHA__': JSON.stringify(commitSha),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Target Chrome 90+ for Huawei WebView compatibility
        target: ['es2020', 'chrome90', 'safari14'],
        rollupOptions: {
          output: {
            manualChunks(id) {
              // Split vendor libs for better long-term caching
              if (id.includes('node_modules/')) {
                if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
                  return 'react-vendor';
                }
                if (id.includes('/@tanstack/')) {
                  return 'tanstack';
                }
                if (id.includes('/lucide-react/')) {
                  return 'icons';
                }
                if (id.includes('/motion/') || id.includes('/framer-motion/')) {
                  return 'motion';
                }
                if (id.includes('/@telegram-apps/')) {
                  return 'telegram-sdk';
                }
              }
            }
          }
        }
      }
    };
});
