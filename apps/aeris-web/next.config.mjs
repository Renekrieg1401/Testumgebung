/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@aeris/crypto-core', '@aeris/shared-schemas', '@aeris/fhir-export'],
};

export default nextConfig;
