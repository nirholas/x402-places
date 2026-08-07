# Exposing x402-places as an MCP tool

[MCP](https://modelcontextprotocol.io) lets Claude (and other MCP clients) call
this service directly. The wrapper below holds the wallet, pays the x402
invoice, and hands the artifact straight back to the model.

## Minimal server

```ts
// mcp-x402-places.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSigner, wrapFetchWithPayment } from "x402-fetch";
import { z } from "zod";

const BASE_URL = process.env.PLACES_URL ?? "http://localhost:4022";

const signer = await createSigner("base-sepolia", process.env.PRIVATE_KEY!);
const payFetch = wrapFetchWithPayment(fetch, signer);

const server = new McpServer({ name: "x402-places", version: "0.1.0" });

server.tool(
  "search_places",
  "Search points of interest around a coordinate (live OpenStreetMap)",
  {
    lat: z.number().describe("Latitude, -90…90."),
    lon: z.number().describe("Longitude, -180…180."),
    radius: z.number().optional().describe("Search radius in **metres**, 0…5000. Default 500."),
    category: z.string().optional().describe("OSM tag value to filter on — matched against `amenity`, `shop`, `leisure` and `tourism`. e.g. `cafe`, `restaurant`, `pharmacy`, `bar`, `museum`, `bakery`. Omit for any amenity."),
    limit: z.number().optional().describe("Maximum results, 1…50. Default 20."),
  },
  async (args) => {
    const url = new URL(`${BASE_URL}/search`);
    url.searchParams.set("lat", String(args.lat));
    url.searchParams.set("lon", String(args.lon));
    if (args.radius) url.searchParams.set("radius", String(args.radius));
    if (args.category) url.searchParams.set("category", args.category);
    if (args.limit) url.searchParams.set("limit", String(args.limit));
    const res = await payFetch(url);
    if (!res.ok) throw new Error(`GET /search → ${res.status}`);
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

server.tool(
  "place_detail",
  "Full record for one OpenStreetMap place, plus review enrichment",
  {
    id: z.string().describe("Place id as returned by `/search` — `node-…`, `way-…` or `relation-…`."),
  },
  async (args) => {
    const url = `${BASE_URL}/detail/${encodeURIComponent(args.id)}`;
    const res = await payFetch(url);
    if (!res.ok) throw new Error(`GET /detail/:id → ${res.status}`);
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
```

## Wire it into Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-places": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-x402-places.ts"],
      "env": {
        "PRIVATE_KEY": "0xYourFundedTestKey",
        "PLACES_URL": "http://localhost:4022"
      }
    }
  }
}
```

## Spending caps

Each GET /search call costs $0.002. Wrap `payFetch` with a
budget so a runaway loop cannot drain the wallet:

```ts
let spentMicros = 0;
const CAP_MICROS = 1_000_000; // $1.00

const cappedFetch: typeof fetch = async (input, init) => {
  if (spentMicros >= CAP_MICROS) throw new Error("x402 spend cap reached");
  const res = await payFetch(input, init);
  const receipt = res.headers.get("X-PAYMENT-RESPONSE");
  if (receipt) {
    const { amount } = JSON.parse(Buffer.from(receipt, "base64").toString());
    spentMicros += Number(amount ?? 0);
  }
  return res;
};
```

## Notes

- The tool descriptions above come from [`skill.md`](../skill.md) — keep them in
  sync so the model knows exactly what it is buying.
- Paying on Solana instead? Swap `x402-fetch` for a Solana x402 client; the 402
  challenge already advertises the `solana` rail, so nothing on this
  server changes.
- Discovery for autonomous agents: [`/.well-known/x402`](../public/.well-known/x402).
