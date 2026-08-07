# x402-places — agent skill

Find real points of interest — restaurants, cafes, pharmacies, museums, anything
tagged in OpenStreetMap — around a coordinate, and pull the full record for any
one of them. Places come from the OpenStreetMap Overpass API, called live on
every request. The detail route adds review enrichment: live Yelp ratings and
reviews when `YELP_API_KEY` is configured, deterministic fixtures otherwise
(always labelled in `enrichment.source`).

**Base URL:** `{BASE_URL}` (local default `http://localhost:4022`)

Every paid call returns the purchased artifact **in the 200 response body**.
There is nothing to poll and nothing to collect later.

## Payment

This service speaks **x402** (HTTP 402 Payment Required, <https://x402.org>).

**Pay in USDC on Base or Solana — your client picks the rail.**

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Facilitator: `https://x402.org/facilitator` (verifies and settles both rails).

Flow:

1. Call the endpoint with no `X-PAYMENT` header. You get **402** with an
   `accepts` array holding **both** rails.
2. Pick a rail, sign the payment, and put the base64 payload in `X-PAYMENT`.
3. Repeat the request. You get **200** with the artifact, and a settlement
   receipt in the `X-PAYMENT-RESPONSE` header (base64 JSON:
   `{ success, rail, network, transaction, payer, amount, asset }`).

Use `x402-fetch` (EVM), a Solana x402 client, or any x402-aware HTTP client —
the wire format is the standard one.

```ts
import { wrapFetchWithPayment, createSigner } from "x402-fetch";
const signer = await createSigner("base-sepolia", process.env.PRIVATE_KEY!);
const pay = wrapFetchWithPayment(fetch, signer);
const res = await pay("{BASE_URL}/search?lat=41.3851&lon=2.1734&radius=300&category=cafe&limit=2");
const artifact = await res.json();
```

## Endpoints

### `GET /search` — $0.002

Search points of interest around a coordinate (live OpenStreetMap)

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `lat` | query | yes | number | Latitude, -90…90. |
| `lon` | query | yes | number | Longitude, -180…180. |
| `radius` | query | no | number | Search radius in **metres**, 0…5000. Default 500. |
| `category` | query | no | string | OSM tag value to filter on — matched against `amenity`, `shop`, `leisure` and `tourism`. e.g. `cafe`, `restaurant`, `pharmacy`, `bar`, `museum`, `bakery`. Omit for any amenity. |
| `limit` | query | no | integer | Maximum results, 1…50. Default 20. |

**Returns** (`200 application/json`) — POIs near the coordinate: name, category, geo, opening hours, phone, website, address, cuisine, full OSM tags

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

<details><summary>Response schema</summary>

```json
{
  "type": "object",
  "required": [
    "source",
    "query",
    "count",
    "places",
    "retrievedAt"
  ],
  "properties": {
    "source": {
      "type": "string",
      "enum": [
        "overpass"
      ],
      "description": "Always `overpass` — live OpenStreetMap data."
    },
    "query": {
      "type": "object",
      "properties": {
        "latitude": {
          "type": "number"
        },
        "longitude": {
          "type": "number"
        },
        "radiusM": {
          "type": "number"
        },
        "category": {
          "type": [
            "string",
            "null"
          ]
        },
        "limit": {
          "type": "integer"
        }
      }
    },
    "count": {
      "type": "integer"
    },
    "retrievedAt": {
      "type": "string",
      "format": "date-time"
    },
    "places": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "osmType",
          "osmId",
          "name",
          "tags"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "`<osmType>-<osmId>`, e.g. `node-1072800838`. Pass to `/detail/:id`."
          },
          "osmType": {
            "type": "string",
            "enum": [
              "node",
              "way",
              "relation"
            ]
          },
          "osmId": {
            "type": "integer"
          },
          "name": {
            "type": "string"
          },
          "category": {
            "type": [
              "string",
              "null"
            ],
            "description": "The `amenity`/`shop`/`leisure`/`tourism` value."
          },
          "latitude": {
            "type": [
              "number",
              "null"
            ]
          },
          "longitude": {
            "type": [
              "number",
              "null"
            ]
          },
          "openingHours": {
            "type": [
              "string",
              "null"
            ],
            "description": "Raw OSM `opening_hours` expression."
          },
          "phone": {
            "type": [
              "string",
              "null"
            ]
          },
          "website": {
            "type": [
              "string",
              "null"
            ]
          },
          "address": {
            "type": [
              "string",
              "null"
            ]
          },
          "cuisine": {
            "type": [
              "string",
              "null"
            ]
          },
          "tags": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "description": "Complete untouched OSM tag set."
          }
        }
      }
    }
  }
}
```

</details>

---

### `GET /detail/:id` — $0.002

Full record for one OpenStreetMap place, plus review enrichment

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `id` | path | yes | string | Place id as returned by `/search` — `node-…`, `way-…` or `relation-…`. |

**Returns** (`200 application/json`) — The complete OSM record for that place plus `enrichment` — rating, review count, price level and reviews (live Yelp when keyed, fixture otherwise)

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

<details><summary>Response schema</summary>

```json
{
  "type": "object",
  "required": [
    "source",
    "place",
    "enrichment",
    "retrievedAt"
  ],
  "properties": {
    "source": {
      "type": "string",
      "enum": [
        "overpass"
      ]
    },
    "retrievedAt": {
      "type": "string",
      "format": "date-time"
    },
    "place": {
      "type": "object",
      "required": [
        "id",
        "osmType",
        "osmId",
        "name",
        "tags"
      ],
      "properties": {
        "id": {
          "type": "string",
          "description": "`<osmType>-<osmId>`, e.g. `node-1072800838`. Pass to `/detail/:id`."
        },
        "osmType": {
          "type": "string",
          "enum": [
            "node",
            "way",
            "relation"
          ]
        },
        "osmId": {
          "type": "integer"
        },
        "name": {
          "type": "string"
        },
        "category": {
          "type": [
            "string",
            "null"
          ],
          "description": "The `amenity`/`shop`/`leisure`/`tourism` value."
        },
        "latitude": {
          "type": [
            "number",
            "null"
          ]
        },
        "longitude": {
          "type": [
            "number",
            "null"
          ]
        },
        "openingHours": {
          "type": [
            "string",
            "null"
          ],
          "description": "Raw OSM `opening_hours` expression."
        },
        "phone": {
          "type": [
            "string",
            "null"
          ]
        },
        "website": {
          "type": [
            "string",
            "null"
          ]
        },
        "address": {
          "type": [
            "string",
            "null"
          ]
        },
        "cuisine": {
          "type": [
            "string",
            "null"
          ]
        },
        "tags": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          },
          "description": "Complete untouched OSM tag set."
        }
      }
    },
    "enrichment": {
      "type": "object",
      "required": [
        "source",
        "rating",
        "reviewCount",
        "reviews"
      ],
      "properties": {
        "source": {
          "type": "string",
          "enum": [
            "yelp",
            "fixture"
          ]
        },
        "rating": {
          "type": "number"
        },
        "reviewCount": {
          "type": "integer"
        },
        "priceLevel": {
          "type": [
            "string",
            "null"
          ]
        },
        "yelpUrl": {
          "type": [
            "string",
            "null"
          ],
          "format": "uri"
        },
        "note": {
          "type": "string"
        },
        "reviews": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rating": {
                "type": "number"
              },
              "text": {
                "type": "string"
              },
              "author": {
                "type": "string"
              },
              "createdAt": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  }
}
```

</details>


## Free endpoints

- `GET /` — Service metadata, live prices, active payment rails, backend status
- `GET /health` — Liveness probe
- `GET /.well-known/x402` — Machine-readable discovery manifest

## Error codes

| HTTP | `error` | Meaning |
|------|---------|---------|
| 400 | `invalid_lat` | `lat` missing or outside -90…90. |
| 400 | `invalid_lon` | `lon` missing or outside -180…180. |
| 400 | `invalid_radius` | `radius` outside 0…5000 metres. |
| 400 | `invalid_limit` | `limit` outside 1…50. |
| 400 | `invalid_category` | `category` is not a plain OSM tag value. |
| 400 | `invalid_id` | `id` is not `node-…`, `way-…` or `relation-…`. |
| 404 | `not_found` | No OSM element with that id. |
| 502 | `upstream_error` | Overpass (or Yelp) failed or timed out. |
| 402 | — | Payment required or rejected. Body carries `accepts` (both rails) and an `error` reason. |
| 500 | `no_payment_rail_configured` | Server has neither a valid EVM nor Solana payTo. |

## Data source

**Places: live, always.** Every `/search` and `/detail` call hits the
[OpenStreetMap Overpass API](https://overpass-api.de) for real. Overpass is
keyless, so there is no fixture mode for place data and `source` is always
`"overpass"`. Point `OVERPASS_URL` at your own instance if you need throughput.

**Reviews: env-gated.** `/detail` adds `enrichment` from
[Yelp Fusion](https://docs.developer.yelp.com) when `YELP_API_KEY` is set
(`enrichment.source: "yelp"`). Without a key it returns a deterministic fixture
enrichment (`enrichment.source: "fixture"`) so the demo runs with no
credentials. Check `enrichment.source` before treating ratings as real.

OpenStreetMap data is © OpenStreetMap contributors, licensed
[ODbL](https://www.openstreetmap.org/copyright) — attribute it downstream.

## Discovery

Machine-readable manifest: **`GET /.well-known/x402`**
(also at <https://github.com/nirholas/x402-places/blob/main/public/.well-known/x402>).
Indexed by [x402scan.com](https://x402scan.com), the x402 Bazaar, and
[agentic.market](https://agentic.market).

OpenAPI 3.1: [`openapi.json`](https://github.com/nirholas/x402-places/blob/main/openapi.json)

## Contact

nichxbt@gmail.com · <https://github.com/nirholas/x402-places>
