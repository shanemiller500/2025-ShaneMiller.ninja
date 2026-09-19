# shanemiller.ninja

## Updating the resume

Edit `app/resume/content.json` to update the biography, resume summary, experience,
and skills. Run `npm run resume:pdf` to regenerate `public/PDF/ShaneMiller-2026.pdf`
from the same content. The generator uses local Chrome or Edge; set `CHROME_PATH`
if the browser is installed elsewhere. It checks the two-page layout and saves
page previews in the temporary directory printed by the command.

Welcome to my portfolio website! This project is built using [Next.js](https://nextjs.org/), [TypeScript](https://www.typescriptlang.org/), and JavaScript. Here you can find my projects, experiences, and skills in web development.

## Getting Started

To set up the project locally, follow these steps:

### Prerequisites

- [Node.js](https://nodejs.org/) (v22 or later; the CoinCap relay uses the native WebSocket client)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)

### Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-username/shanemiller.ninja.git
cd shanemiller.ninja
npm install
# or if you prefer Yarn:
# yarn install
```

### CoinCap configuration

Set `COINCAP_API_KEY` in `.env.local` and in the deployment environment. It is a
server-only secret. Remove the old `NEXT_PUBLIC_COINCAP_API_KEY` setting and
restart development or rebuild/redeploy after migrating. Rotate any previously
published key in the CoinCap dashboard.

All crypto components use `/api/coincap/*`. REST requests authenticate with a
server-side Bearer header and cache successful data for 60 seconds. The streaming
route relays CoinCap WebSocket prices over server-sent events; only the server
connects to CoinCap with the key. It renews connections before the deployment's
30-second function timeout. CoinCap WebSocket access still requires an eligible
plan, and relayed connections still consume provider credits.


