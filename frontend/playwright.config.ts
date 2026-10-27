import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'uv run uvicorn app.main:app --host 127.0.0.1 --port 8000', cwd: '../backend', url: 'http://127.0.0.1:8000/api/v1/health', reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1', cwd: '.', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
  ],
})
