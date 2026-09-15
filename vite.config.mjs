import { defineConfig } from 'vite';

// Phase 2 of the modernization plan: introduce a build system as a
// parallel dev tool WITHOUT touching how the app is deployed today.
// index.html loads every script as a plain classic <script src="...">
// tag (no `type="module"`), so Vite's dev/build pipeline leaves them
// alone and serves them as static files exactly like the current
// `npx serve .` workflow — this config changes nothing about runtime
// behavior. `npm run dev` is a drop-in replacement for `npx serve .`
// with the option to start real module-based extraction (Phase 3+)
// later, in the same project, without a second migration.
export default defineConfig({
  root: '.',
  publicDir: false,
  server: {
    port: 3000,
  },
  build: {
    // No JS/TS entry points exist yet (Phase 3 introduces the first
    // one, per MIGRATION_PLAN.md). Until then `vite build` just
    // copies the static site through, matching current deployment.
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
});
