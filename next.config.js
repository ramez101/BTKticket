/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'nodemailer'],
  },
}
module.exports = nextConfig
