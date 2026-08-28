/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Modulos que solo existen en Node y no deben pasar por el bundler del
  // servidor: better-sqlite3 es nativo, e imapflow/mailparser abren sockets y
  // usan APIs de Node que webpack no sabe empaquetar.
  serverExternalPackages: ['better-sqlite3', 'imapflow', 'mailparser'],
};

export default nextConfig;
