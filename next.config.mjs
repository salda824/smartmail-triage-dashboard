/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 es un modulo nativo: no debe pasar por el bundler del servidor.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
