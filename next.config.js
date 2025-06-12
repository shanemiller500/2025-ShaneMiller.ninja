// next.config.js

const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Include MDX among your page extensions
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],

  // Generate proper source maps in development so Next’s overlay can fetch original frames
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = 'source-map'
    }
    return config
  },

  // Optional: hide Next.js build spinner messages in the console
  devIndicators: {
    buildActivity: false
  }
}

module.exports = withMDX(nextConfig)
