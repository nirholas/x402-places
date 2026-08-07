# x402-places

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![x402](https://img.shields.io/badge/payments-x402-0052ff.svg)](https://x402.org)
[![USDC on Base](https://img.shields.io/badge/USDC-Base-0052ff.svg)](https://base.org)
[![USDC on Solana](https://img.shields.io/badge/USDC-Solana-14f195.svg)](https://solana.com)

**POI concierge over OpenStreetMap Overpass with optional Yelp enrichment —
restaurants, cafes, anything, per query.** $0.002 in USDC on Base *or* Solana
per call, and the places come back in the response body: opening hours, phone,
website, address, cuisine, and the full OSM tag set.

Docs site: **https://nirholas.github.io/x402-places/**

## Why x402 for this

Places data is either free-but-raw (you run your own Overpass client and parse
OSM tags) or polished-but-gated (a commercial API with a key, a contract, and a
monthly floor). Neither fits an agent that needs one clean answer about one
neighbourhood, once. x402 makes the middle ground possible: the route quotes
$0.002 in the 402 response, the agent pays on whichever chain it holds funds on,
and it gets normalised POI records with no account, no key, and no minimum.

## Quickstart

```bash
git clone https://github.com/nirholas/x402-places
cd x402-places
npm install
npm run dev            # http://localhost:4022 — no configuration needed
```

See the price with no wallet at all:

```bash
curl -s "http://localhost:4022/search?lat=41.3851&lon=2.1734&radius=300&category=cafe&limit=2" | jq
# 402 + accepts: [ USDC on Base, USDC on Solana ]
```

Then buy it, from an agent (wallet funded with Base Sepolia USDC —
https://faucet.circle.com):

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

## API

| Route | Price | What you get back |
|-------|-------|-------------------|
| `GET /search` | **$0.002** | POIs near the coordinate: name, category, geo, opening hours, phone, website, address, cuisine, full OSM tags |
| `GET /detail/:id` | **$0.002** | The complete OSM record for that place plus `enrichment` — rating, review count, price level and reviews (live Yelp when keyed, fixture otherwise) |
| `GET /` | free | Service metadata, live prices, active payment rails, backend status |
| `GET /health` | free | Liveness probe |
| `GET /.well-known/x402` | free | Machine-readable discovery manifest |

Full reference: [docs/api.md](docs/api.md) · [openapi.json](openapi.json)

## How x402 works

**Pay in USDC on Base or Solana — your client picks the rail.**

1. **402** — the route, called without payment, replies HTTP 402 with an
   `accepts` array holding **both** rails: exact price
   ($0.002 → `2000` USDC base units), asset, and `payTo`.
2. **Sign** — on Base, the client signs an EIP-3009 USDC authorization (no gas
   from the payer). On Solana, it signs an SPL `transferChecked` whose fee payer
   is the facilitator's sponsor account (so the buyer needs USDC only, no SOL).
3. **Settle** — the server hands the payload to the facilitator
   (`https://x402.org/facilitator`), which verifies and settles on the chosen chain.
4. **200** — the same request returns the artifact in the body, with the
   settlement receipt in the `X-PAYMENT-RESPONSE` header.

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Those are the suite's public receive addresses and the server's defaults. Set
`PAY_TO_ADDRESS` / `SOLANA_PAY_TO_ADDRESS` to be paid yourself.

Walkthroughs: [examples/curl.md](examples/curl.md) ·
[examples/agent-client.ts](examples/agent-client.ts) ·
[docs/tutorial.md](docs/tutorial.md)

## Real backend / API keys

| Env | Effect |
|-----|--------|
| *(none — Overpass is keyless)* | Place data is **always live** from the [OpenStreetMap Overpass API](https://overpass-api.de). No key, no fixture mode. Set `OVERPASS_URL` to use your own Overpass instance. |
| `YELP_API_KEY` | Live [Yelp Fusion](https://docs.developer.yelp.com) ratings and reviews on `/detail/:id` (`enrichment.source: "yelp"`). Free tier available. |
| *(`YELP_API_KEY` unset)* | Deterministic fixture enrichment, labelled `enrichment.source: "fixture"`. Same place → same numbers. The demo never requires a key. |

All variables: [.env.example](.env.example)

## For AI agents

- **[skill.md](skill.md)** — agent-facing skill file: endpoints, prices,
  schemas, both payment rails. Point your agent at it.
- **`GET /.well-known/x402`** — discovery manifest listing every resource with
  both networks. Indexable by [x402scan.com](https://x402scan.com), the x402
  Bazaar, and [agentic.market](https://agentic.market).
- **MCP** — [examples/mcp-tool.md](examples/mcp-tool.md) exposes these routes as
  Claude MCP tools, with per-wallet spend caps and a
  `claude_desktop_config.json` example.
- More: [docs/agents.md](docs/agents.md)

## Docs

- Landing: https://nirholas.github.io/x402-places/
- [Tutorial](docs/tutorial.md) · [API reference](docs/api.md) · [For AI agents](docs/agents.md)

## Support

Questions, bugs, or a listing request: **nichxbt@gmail.com** ·
[open an issue](https://github.com/nirholas/x402-places/issues)

## License

Apache-2.0. Part of the [x402 Suite](https://github.com/nirholas/x402-suite).
