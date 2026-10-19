import { defineConfig } from "vitest/config";

export default defineConfig({
  // expo/tsconfig.base isn't in expo's package exports, which Vite's tsconfig loader requires;
  // the tests only need plain TS stripping.
  esbuild: { tsconfigRaw: "{}" },
  test: { include: ["lib/**/*.test.ts"] },
});
