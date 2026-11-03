// next.config.js
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

let boulderSnapshotFiles = []
let boulderOldSnapshots = []
// Boulder County has not confirmed that its assessor CSVs may be republished (docs/land-intelligence/PHASE1_FOUNDATIONS.md).
// Until a deployment sets LAND_BOULDER_DATA_APPROVED=true, no snapshot file is packaged into a production build.
const boulderApproved = process.env.LAND_BOULDER_DATA_APPROVED === 'true'
try {
  const dataDir = join(__dirname, 'data/land-intelligence/boulder')
  const manifest = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'))
  if (!boulderApproved) boulderOldSnapshots = ['./data/land-intelligence/boulder/**/*']
  else if (manifest.format === 'json-gzip-v1' && /^snapshot-[0-9T-Z-]+$/.test(manifest.snapshot)) {
    boulderSnapshotFiles = [`./data/land-intelligence/boulder/${manifest.snapshot}/*.json.gz`]
    boulderOldSnapshots = readdirSync(dataDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^snapshot-[0-9T-Z-]+$/.test(entry.name) && entry.name !== manifest.snapshot)
      .map((entry) => `./data/land-intelligence/boulder/${entry.name}/**/*`)
  }
} catch { /* No approved local snapshot has been staged yet. */ }

const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Include MDX among your page extensions
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  // A locally approved Boulder snapshot is read only by the parcel detail and comparables APIs
  // (the snapshot folder holds the account buckets and comps.json.gz; centroids.json.gz sits beside the manifest).
  outputFileTracingIncludes: {
    '/api/land-intelligence/parcel-detail': boulderApproved ? [
      './data/land-intelligence/boulder/manifest.json',
      ...boulderSnapshotFiles,
    ] : [],
    // National market files are public-domain federal data (market-import.mjs), so they are always packaged.
    '/api/land-intelligence/market': ['./data/land-intelligence/market/*'],
    '/api/land-intelligence/market-map': ['./data/land-intelligence/market/*'],
    '/api/land-intelligence/report': ['./data/land-intelligence/market/*'],
    '/api/land-intelligence/comparables': boulderApproved ? [
      './data/land-intelligence/boulder/manifest.json',
      './data/land-intelligence/boulder/centroids.json.gz',
      ...boulderSnapshotFiles,
    ] : [],
  },
  outputFileTracingExcludes: {
    '/api/land-intelligence/parcel-detail': boulderOldSnapshots,
    '/api/land-intelligence/comparables': boulderOldSnapshots,
  },

  // Generate proper source maps in development so Next’s overlay can fetch original frames
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = 'source-map'
    }
    return config
  },

  // renamed atlas maps keep their old links
  async redirects() {
    return [{ source: "/atlas/underground-usa", destination: "/atlas/underground", permanent: true }];
  },

  // Optional: hide Next.js build spinner messages in the console
  devIndicators: {
    buildActivity: false
  }
}

module.exports = withMDX(nextConfig)
