import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  clean: true,
  target: "node18",
  outExtension: () => ({ js: ".js" }),
  banner: {
    js: "#!/usr/bin/env node",
  },
});
