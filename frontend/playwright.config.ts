import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3005",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3005",
    port: 3005,
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
      NEXT_PUBLIC_SOCKET_URL: "http://127.0.0.1:4000",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
