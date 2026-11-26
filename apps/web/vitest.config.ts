import { defineConfig } from "vitest/config";

export default defineConfig({
  // Keep paths as given (the repo may live on a mapped / subst drive;
  // resolving to the real path can exceed Windows MAX_PATH).
  resolve: { preserveSymlinks: true },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    testTimeout: 20000,
  },
});
