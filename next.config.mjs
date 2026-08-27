/** @type {import("next").NextConfig} */
const nextConfig = {
  // ECS 部署时启用 standalone 输出（deploy.sh 会设置 ECS_STANDALONE=1）；
  // Netlify 构建不受影响（不设置该变量时保持原行为）。
  ...(process.env.ECS_STANDALONE === "1" ? { output: "standalone" } : {}),
};

export default nextConfig;
