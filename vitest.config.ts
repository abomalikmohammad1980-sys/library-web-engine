import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@engine/bidi": resolve(__dirname, "packages/bidi/src/index.ts"),
      "@engine/font-system": resolve(__dirname, "packages/font-system/src/index.ts"),
      "@engine/interact": resolve(__dirname, "packages/interact/src/index.ts"),
      "@engine/layout": resolve(__dirname, "packages/layout/src/index.ts"),
      "@engine/ooxml-model": resolve(__dirname, "packages/ooxml-model/src/index.ts"),
      "@engine/ooxml-dom": resolve(__dirname, "packages/ooxml-dom/src/index.ts"),
      "@engine/shaper": resolve(__dirname, "packages/shaper/src/index.ts"),
      "@engine/scene": resolve(__dirname, "packages/scene/src/index.ts"),
      "@engine/paint": resolve(__dirname, "packages/paint/src/index.ts"),
      "@library/source-sync": resolve(__dirname, "packages/source-sync/src/index.ts"),
      "@library/word-cover": resolve(__dirname, "packages/word-cover/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "app/src/**/*.test.ts",
    ],
    // بناءُ مشاهد كاملة (تشكيل HarfBuzz-WASM) ثقيل — مهلة مريحة تحت ضغط الملفات المتوازية
    testTimeout: 30000,
  },
});
