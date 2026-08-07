# API reference — x402-places

Base URL: `http://localhost:4022` in development.
Machine-readable: [`openapi.json`](https://github.com/nirholas/x402-places/blob/main/openapi.json) (OpenAPI 3.1).

All paid routes return the purchased artifact in the **200 response body**.

## Payment

Every paid route answers an unpaid request with **402** and an `accepts` array
holding both rails:

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Prices are quoted in USDC base units (6 decimals) as `maxAmountRequired`.
On success the response carries `X-PAYMENT-RESPONSE`: base64 JSON with
`{ success, rail, network, transaction, payer, amount, asset }`.

---

## `GET /search`

**$0.002** — Search points of interest around a coordinate (live OpenStreetMap)

### Parameters

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `lat` | query | yes | number | Latitude, -90…90. |
| `lon` | query | yes | number | Longitude, -180…180. |
| `radius` | query | no | number | Search radius in **metres**, 0…5000. Default 500. |
| `category` | query | no | string | OSM tag value to filter on — matched against `amenity`, `shop`, `leisure` and `tourism`. e.g. `cafe`, `restaurant`, `pharmacy`, `bar`, `museum`, `bakery`. Omit for any amenity. |
| `limit` | query | no | integer | Maximum results, 1…50. Default 20. |

### Example request

```bash
curl -s "http://localhost:4022/search?lat=41.3851&lon=2.1734&radius=300&category=cafe&limit=2" -H "X-PAYMENT: <base64 payload>"
```

### Response `200 application/json`

`source` is always `"overpass"` — place data is live, never a fixture. `tags` is the complete untouched OSM tag set for the element.

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

### Errors

| HTTP | `error` | When |
|------|---------|------|
| 400 | `invalid_lat` | `lat` missing or outside -90…90. |
| 400 | `invalid_lon` | `lon` missing or outside -180…180. |
| 400 | `invalid_radius` | `radius` outside 0…5000 metres. |
| 400 | `invalid_limit` | `limit` outside 1…50. |
| 400 | `invalid_category` | `category` is not a plain OSM tag value (lowercase letters, digits, underscores). |
| 402 | — | No or invalid `X-PAYMENT`. Body carries `accepts` with both rails. |
| 502 | `upstream_error` | The upstream data source failed or timed out. |

---

## `GET /detail/:id`

**$0.002** — Full record for one OpenStreetMap place, plus review enrichment

### Parameters

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `id` | path | yes | string | Place id as returned by `/search` — `node-…`, `way-…` or `relation-…`. |

### Example request

```bash
curl -s "http://localhost:4022/detail/node-1072800838" -H "X-PAYMENT: <base64 payload>"
```

### Response `200 application/json`

`place` is the live OSM record. `enrichment.source` tells you whether the ratings are real (`"yelp"`) or deterministic demo data (`"fixture"`).

```json
{
  "source": "overpass",
  "place": {
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
  "enrichment": {
    "source": "fixture",
    "rating": 3.4,
    "reviewCount": 58,
    "priceLevel": "$",
    "yelpUrl": null,
    "reviews": [
      {
        "rating": 4,
        "text": "A bit crowded at peak hours but worth the wait.",
        "author": "demo_user_475",
        "createdAt": "2024-02-09T08:35:18.084Z"
      },
      {
        "rating": 3,
        "text": "Good value for the neighborhood; portions are generous.",
        "author": "demo_user_973",
        "createdAt": "2025-01-27T08:21:00.428Z"
      },
      {
        "rating": 3,
        "text": "A bit crowded at peak hours but worth the wait.",
        "author": "demo_user_353",
        "createdAt": "2024-07-25T14:05:24.680Z"
      }
    ],
    "note": "Deterministic fixture enrichment — set YELP_API_KEY for live Yelp data."
  },
  "retrievedAt": "2026-08-07T02:40:21.454Z"
}
```

### Errors

| HTTP | `error` | When |
|------|---------|------|
| 400 | `invalid_id` | `id` is not `node-…`, `way-…` or `relation-…`. |
| 404 | `not_found` | No OpenStreetMap element with that id. |
| 402 | — | No or invalid `X-PAYMENT`. Body carries `accepts` with both rails. |
| 502 | `upstream_error` | The upstream data source failed or timed out. |


---

## Free routes

### `GET /`

Service metadata: description, live prices, active payment rails, data-source
status, and docs links.

### `GET /health`

```json
{ "status": "ok", "uptime": 12.5 }
```

### `GET /.well-known/x402`

The discovery manifest — every resource with its price, output schema, and both
accepted rails. See [agents.md](agents.md).
