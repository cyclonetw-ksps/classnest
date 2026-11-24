import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  root: "src/web",
  publicDir: "public",
  build: { outDir: "../../dist", emptyOutDir: true },
});
