# Tutorial — x402-places

From a clean checkout to a paid API call, on either payment rail.

## 1. Install

```bash
git clone https://github.com/nirholas/x402-places
cd x402-places
npm install
```

Node 18 or newer.

## 2. Configure (optional)

```bash
cp .env.example .env
```

Nothing is required. Out of the box the server:

- listens on port `4022`,
- accepts USDC on **Base Sepolia** and on **Solana**, paying out to the suite's
  public receive addresses,
- serves **live** OpenStreetMap data from Overpass (no key needed) with fixture review enrichment.

To be paid yourself, change these two lines:

```bash
PAY_TO_ADDRESS=0xYourEvmAddress
SOLANA_PAY_TO_ADDRESS=YourSolanaAddress
```

Place data is live out of the box — Overpass is keyless. To also get **real**
Yelp ratings and reviews on `/detail/:id`, add a free key from
<https://docs.developer.yelp.com>:

```bash
YELP_API_KEY=your_yelp_key
```

`enrichment.source` then reads `"yelp"` instead of `"fixture"`. Everything else
— routes, prices, payment — is identical.

## 3. Run the server

```bash
npm run dev
```

```
x402-places v0.1.0 listening on :4022
  payment rails:
    EVM     base-sepolia  USDC → 0x40252CFDF8B20Ed757D61ff157719F33Ec332402
    Solana  solana         USDC → WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW
  facilitator: https://x402.org/facilitator
  paid routes:
    GET /search                  $0.002
    GET /detail/:id              $0.002
  free routes: GET /, GET /health, GET /.well-known/x402
```

Check it is alive:

```bash
curl -s http://localhost:4022/health
# {"status":"ok","uptime":1.2}
```

## 4. Your first 402

```bash
curl -s "http://localhost:4022/search?lat=41.3851&lon=2.1734&radius=300&category=cafe&limit=2" | jq
```

You get HTTP **402** and a challenge listing **both** rails:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    { "scheme": "exact", "network": "base-sepolia", "maxAmountRequired": "2000",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
    { "scheme": "exact", "network": "solana", "maxAmountRequired": "2000",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }
  ]
}
```

That is the whole price negotiation: no key, no signup, no account. The price
is `2000` USDC base units (6 decimals) = **$0.002**.

## 5. Pay for real

Get a Base Sepolia test wallet and fund it with test USDC from
<https://faucet.circle.com>. Then:

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

[`examples/agent-client.ts`](../examples/agent-client.ts) does the full flow:

1. Calls the route unpaid and prints both rails from the 402.
2. Signs an EIP-3009 USDC authorization for exactly $0.002.
3. Retries with the `X-PAYMENT` header.
4. Prints the artifact and decodes the `X-PAYMENT-RESPONSE` receipt.

Prefer Solana? The bottom of that file shows the equivalent flow — the server
needs no changes, since the same 402 already advertises the `solana` rail.

## 6. Read the artifact

The 200 body **is** the purchase:

```json
{
  "source": "overpass",
  "query": {
    "latitude": 41.3851,
    "longitude": 2.1734,
    "radiusM": 300,
    "category": "cafe",
    "limit": 2
  },
  "count": 2,
  "places": [
    {
      "id": "node-1072800838",
      "osmType": "node",
      "osmId": 1072800838,
      "name": "El Cafè D'en Victor",
      "category": "cafe",
      "latitude": 41.3847931,
      "longitude": 2.1767008,
      "openingHours": null,
      "phone": null,
      "website": null,
      "address": "12 Carrer de la Tapineria, 08002",
      "cuisine": null,
      "tags": {
        "addr:housenumber": "12",
        "addr:postcode": "08002",
        "addr:street": "Carrer de la Tapineria",
        "amenity": "cafe",
        "check_date": "2023-04-23",
        "name": "El Cafè D'en Victor",
        "outdoor_seating": "yes",
        "wheelchair": "yes"
      }
    },
    {
      "id": "node-2610015274",
      "osmType": "node",
      "osmId": 2610015274,
      "name": "Chocolate Box",
      "category": "cafe",
      "latitude": 41.384715,
      "longitude": 2.17514,
      "openingHours": null,
      "phone": null,
      "website": null,
      "address": "Carrer dels Capellans",
      "cuisine": "coffee_shop",
      "tags": {
        "addr:street": "Carrer dels Capellans",
        "amenity": "cafe",
        "cuisine": "coffee_shop",
        "name": "Chocolate Box",
        "outdoor_seating": "no",
        "source": "Survey",
        "takeaway": "yes"
      }
    }
  ],
  "retrievedAt": "2026-08-07T02:40:20.141Z"
}
```

Those are real OpenStreetMap records, fetched live. `tags` carries the complete
untouched OSM tag set, so anything the normalised fields miss is still there.
Feed a place's `id` (e.g. `node-1072800838`) to `/detail/:id` for the full
record plus review enrichment.

Full field-by-field reference: [api.md](api.md).

## 7. Going to mainnet

```bash
# EVM: Base mainnet
NETWORK=base
PAY_TO_ADDRESS=0xYourRealAddress

# Solana: mainnet (this is already the default)
SOLANA_NETWORK=mainnet-beta
SOLANA_PAY_TO_ADDRESS=YourRealSolanaAddress
SOLANA_RPC_URL=https://your-dedicated-rpc.example.com

# A facilitator that settles on the networks you accept
FACILITATOR_URL=https://x402.org/facilitator
```

Then run `npm run build && npm start`. Nothing else changes: the same routes,
the same prices, real USDC.

> Use a dedicated Solana RPC in production. The public endpoint is heavily
> rate-limited.

## Where to go next

- [api.md](api.md) — every endpoint, parameter, and error
- [agents.md](agents.md) — discovery, MCP, and listing your instance
- [../skill.md](https://github.com/nirholas/x402-places/blob/main/skill.md) — the agent-facing skill file
- [../examples/curl.md](https://github.com/nirholas/x402-places/blob/main/examples/curl.md) — the same flow in raw curl
