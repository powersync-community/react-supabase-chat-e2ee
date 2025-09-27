import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

for (const name of ['.env.local', '.env']) {
  const fullPath = path.resolve(__dirname, name);
  loadEnv({ path: fullPath, override: false });
}

const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_POWERSYNC_URL'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables for Playwright tests: ${missing.join(', ')}. ` +
      'Populate packages/e2ee-chat/frontend/.env.local or export them before running the suite.',
  );
}

const PORT = Number(process.env.PORT || 5888);
const HOST = process.env.HOST || "localhost";
export const BASE_HTTP = `http://${HOST}:${PORT}`;

// Ensure tests that read process.env.BASE_URL get the same host:port
process.env.BASE_URL = process.env.BASE_URL || BASE_HTTP;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_HTTP + "/",
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_HTTP,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  
});
