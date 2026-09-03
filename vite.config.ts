import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

// Standalone Vite config (no external scaffolding package).
// - tsConfigPaths: resolves the "@/*" -> "./src/*" alias from tsconfig.json.
// - tailwindcss(): Tailwind v4's Vite plugin.
// - tanstackStart(): TanStack Start's SSR/router/server-fn compiler. `server.entry`
//   points it at src/server.ts (our SSR error wrapper) instead of its default entry.
// - viteReact(): React fast refresh / JSX transform.
// - resolve.dedupe: prevents duplicate React/TanStack instances if a dependency
//   pulls in its own copy — avoids subtle "invalid hook call" style bugs.
// Deployment target (Vercel, etc.) is auto-detected at build time by Nitro via
// standard platform env vars — no explicit preset needed here.
export default defineConfig({
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
  },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
