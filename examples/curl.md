# Raw HTTP walkthrough — 402 → pay → 200

Everything below is plain `curl`. No SDK required.

## 0. Start the server

```bash
npm install
npm run dev      # http://localhost:4022
```

## 1. Free routes need no payment

```bash
curl -s http://localhost:4022/health
curl -s http://localhost:4022/ | jq
curl -s http://localhost:4022/.well-known/x402 | jq
```

## 2. Call a paid route with no payment → 402, both rails

```bash
curl -s -i "http://localhost:4022/search?lat=41.3851&lon=2.1734&radius=300&category=cafe&limit=2"
```

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "hint": "Pay in USDC on Base or Solana — your client picks the rail. See /.well-known/x402",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "2000",
      "resource": "http://localhost:4022/search",
      "description": "Search points of interest around a coordinate (live OpenStreetMap)",
      "mimeType": "application/json",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "maxTimeoutSeconds": 120,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": { "name": "USDC", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "2000",
      "resource": "http://localhost:4022/search",
      "description": "Search points of interest around a coordinate (live OpenStreetMap)",
      "mimeType": "application/json",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "maxTimeoutSeconds": 120,
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "extra": { "name": "USDC", "decimals": 6, "feePayer": "<facilitator sponsor>" }
    }
  ]
}
```

`maxAmountRequired` is in USDC base units (6 decimals): `2000` = $0.002.

## 3. Build the payment

Pick **one** entry from `accepts`.

**EVM (Base):** sign an EIP-3009 `transferWithAuthorization` for
`maxAmountRequired` USDC to `payTo`. No gas needed from you — the facilitator
submits it.

**Solana:** build an SPL `transferChecked` of `maxAmountRequired` USDC to
`payTo`, with `extra.feePayer` as the transaction fee payer, and sign it. You
need USDC only — the facilitator sponsors the SOL fee.

Either way, base64-encode the x402 payload:

```json
{ "x402Version": 1, "scheme": "exact", "network": "<the rail you picked>", "payload": { … } }
```

In practice, let a library do it:

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

## 4. Repeat the request with the header → 200 + artifact

```bash
curl -s -i "http://localhost:4022/search?lat=41.3851&lon=2.1734&radius=300&category=cafe&limit=2" \
  -H "X-PAYMENT: <base64 payload>"
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJyYWlsIjoiZXZtIiwi…
```

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

Decode the receipt:

```bash
echo '<X-PAYMENT-RESPONSE value>' | base64 -d | jq
# { "success": true, "rail": "evm", "network": "base-sepolia",
#   "transaction": "0x…", "payer": "0x…", "amount": "2000", "asset": "USDC" }
```

The artifact is in the body of that same 200. There is nothing else to fetch.

## All paid routes

```bash
curl -s "http://localhost:4022/search?lat=41.3851&lon=2.1734&radius=300&category=cafe&limit=2" -H "X-PAYMENT: <payload>"   # $0.002
```

```bash
curl -s "http://localhost:4022/detail/node-1072800838" -H "X-PAYMENT: <payload>"   # $0.002
```
