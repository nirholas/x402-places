/**
 * Per-route request/response schemas published in the x402 402 challenge.
 *
 * GENERATED from `openapi.json` — the runtime challenge and the OpenAPI
 * document must agree, and the runtime is authoritative for x402scan
 * discovery. Regenerate rather than hand-editing.
 *
 * Shape follows the x402 Bazaar convention:
 *   `input`  — how to call the route (`type: "http"`, method, query params /
 *              JSON body fields)
 *   `output` — the JSON-Schema of the 200 response body.
 *
 * Keys match the paywall route map in `src/server.ts` exactly.
 */

export type RouteSchema = {
  /** How an agent invokes this route. */
  input: Record<string, unknown>;
  /** JSON-Schema of the artifact returned in the 200 body. */
  output: Record<string, unknown>;
};

export const ROUTE_SCHEMAS: Record<string, RouteSchema> = {
  "GET /search": {
    "input": {
      "type": "http",
      "method": "GET",
      "queryParams": {
        "lat": {
          "type": "number",
          "description": "Latitude, -90…90.",
          "example": 41.3851
        },
        "lon": {
          "type": "number",
          "description": "Longitude, -180…180.",
          "example": 2.1734
        },
        "radius": {
          "type": "number",
          "description": "Search radius in **metres**, 0…5000. Default 500.",
          "example": 300
        },
        "category": {
          "type": "string",
          "description": "OSM tag value to filter on — matched against `amenity`, `shop`, `leisure` and `tourism`. e.g. `cafe`, `restaurant`, `pharmacy`, `bar`, `museum`, `bakery`. Omit for any amenity.",
          "example": "cafe"
        },
        "limit": {
          "type": "integer",
          "description": "Maximum results, 1…50. Default 20.",
          "example": 2
        }
      },
      "queryParamsRequired": [
        "lat",
        "lon"
      ]
    },
    "output": {
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
  },
  "GET /detail/:id": {
    "input": {
      "type": "http",
      "method": "GET"
    },
    "output": {
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
  }
};
