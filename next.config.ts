import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // output: 'export' を削除: app/api/* を使用するため Vercel Serverless でデプロイすること
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
