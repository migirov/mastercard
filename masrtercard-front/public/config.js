// Runtime configuration placeholder. Copied verbatim into the build output, then OVERWRITTEN
// by the container entrypoint (docker-entrypoint.sh) with the values from the environment.
//
// It ships empty on purpose: `npm run dev` and any non-container serving of `dist/` then fall
// back to the VITE_* build-time variables in src/api/demoApi.js, and an image whose entrypoint
// somehow did not run serves a bundle with no token rather than someone else's.
window.__XBS_CONFIG__ = {};
