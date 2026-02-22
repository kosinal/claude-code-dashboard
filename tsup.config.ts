import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["cjs"],
  clean: true,
  target: "node18",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
