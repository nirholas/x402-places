---
name: find-nearby-places
description: Run the x402-places HTTP service and call its paid routes to search OpenStreetMap points of interest around a latitude and longitude and fetch a full place record with optional Yelp enrichment. Use when an agent needs nearby restaurants, cafes or other places and can pay per query in USDC over x402.
---

# x402-places

x402-places searches OpenStreetMap through the live Overpass API on every request. `/detail/:id` adds review enrichment: Yelp when `YELP_API_KEY` is set, labelled fixtures otherwise (see `enrichment.source`).

Paying is irreversible. Before any paid call, show the user the route, price, network and payTo address from the 402 response, and wait for an explicit yes.

## Run the service

From a clone (Node 18+):

```bash
git clone https://github.com/nirholas/x402-places
cd x402-places && npm install
npm run dev        # tsx src/server.ts, listens on :4022 (PORT overrides)
```

Environment (see `.env.example`): `OVERPASS_URL` (default `https://overpass-api.de/api/interpreter`), `YELP_API_KEY` (optional, enables live Yelp enrichment). Payment settings: `PAY_TO_ADDRESS` (Base receive address), `SOLANA_PAY_TO_ADDRESS`, `NETWORK` (`base-sepolia` default, or `base`), `SOLANA_NETWORK`, `FACILITATOR_URL`, `PUBLIC_BASE_URL`. Set your own pay-to addresses to be paid yourself. `npm run build` then `npm start` runs the compiled server.

## Routes

| Route | Price | Params |
|---|---|---|
| `GET /search` | $0.002 | `lat` (-90 to 90) and `lon` (-180 to 180) required; `radius` in metres (0-5000, default 500), `category` (OSM tag value matched on `amenity`, `shop`, `leisure`, `tourism`, e.g. `cafe`, `pharmacy`, `museum`), `limit` (1-50, default 20) |
| `GET /detail/:id` | $0.002 | `id` as returned by `/search` (`node-...`, `way-...` or `relation-...`) |
| `GET /health`, `GET /.well-known/x402` | free | status and discovery |

## Paying

An unpaid request to a paid route returns 402 with an `accepts` array listing both rails (USDC on Base or Solana). Sign the entry your wallet supports and retry with the base64 `X-PAYMENT` header. The settlement receipt is in the `X-PAYMENT-RESPONSE` header. The reference client is `examples/agent-client.ts` (`npm run client`), which uses `x402-fetch` with `PRIVATE_KEY` for a Base Sepolia wallet and `BASE_URL` (default `http://localhost:4022`).

## Example

```bash
curl -i "localhost:4022/search?lat=51.5074&lon=-0.1278&radius=800&category=cafe&limit=10"
# 402 first. After approval and payment: places[] with ids, then pay for GET /detail/<id>.
```
