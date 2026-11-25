import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// `npm run dev` serves the UI on :5173 and forwards API + sample files to the FastAPI server.
// `npm run build` writes into app/web, which FastAPI serves at "/".
const api = "http://localhost:8765";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "../app/web", emptyOutDir: true },
  server: {
    proxy: { "/api": api, "/static": api, "/health": api, "/cv": api },
  },
});
