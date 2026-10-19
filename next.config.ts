import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 本機能は認証付きの業務アプリで、全ページが動的データ（ログインしているユーザー、
  // 権限、DB からの最新状態）に依存する。Next.js 16 の Cache Components 機能
  // （cacheComponents / partialPrefetching）は、Suspense boundary か "use cache"
  // 指示を全データ取得箇所に要求するため、本機能では一律無効化する。
  cacheComponents: false,
  partialPrefetching: false,
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
