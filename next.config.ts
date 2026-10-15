import type { NextConfig } from "next";

// Cache Components stays off: every app page reads the session, and the
// requireMember-at-the-top pattern (IMPL §3.1, D-37) assumes dynamic rendering.
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
