/**
 * x402-places — Express server with the dual-rail x402 paywall.
 *
 * POI concierge over OpenStreetMap Overpass (keyless, live) with optional Yelp
 * enrichment. Paid routes return the purchased artifact directly in the 200
 * response body. Buyers pay in USDC on Base (EVM) or on Solana; the 402
 * challenge advertises both rails and the client picks.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  facilitatorUrl,
  paywall,
  rails,
  solanaCheckoutRouter,
  usingSuiteDefaultPayTo,
  type RoutePrices,
} from "./payments.js";
import { hasYelpKey, parsePoiId, placeDetail, searchPlaces } from "./service.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

/** Paid routes. Anything not listed here is free. */
const ROUTES: RoutePrices = {
  "GET /search": {
    price: "$0.002",
    description:
      "POI search around a coordinate over OpenStreetMap Overpass. Returns places with opening hours, contact details, address and full OSM tags.",
    outputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["overpass"] },
        count: { type: "integer" },
        places: { type: "array", items: { type: "object" } },
      },
    },
  },
  "GET /detail/:id": {
    price: "$0.002",
    description:
      "Full record for one OSM place, plus review enrichment (live Yelp when YELP_API_KEY is set, deterministic fixture otherwise).",
    outputSchema: {
      type: "object",
      properties: {
        place: { type: "object" },
        enrichment: { type: "object" },
      },
    },
  },
};

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Dual-rail x402 paywall: USDC on Base or Solana.
app.use(paywall(ROUTES, { service: "x402-places" }));

// Optional: browser (Phantom) Solana checkout helper.
const checkoutRouter = await solanaCheckoutRouter();
if (checkoutRouter) app.use("/api/x402-checkout", checkoutRouter);

// Discovery manifest — before express.static so it keeps an explicit JSON type.
app.get("/.well-known/x402", (_req, res) => {
  res.type("application/json").sendFile(join(publicDir, ".well-known", "x402"));
});

app.use(express.static(publicDir));

// Free: service info.
app.get("/", (_req, res) => {
  res.json({
    name: "x402-places",
    description:
      "POI concierge over OpenStreetMap Overpass with optional Yelp enrichment — restaurants, cafes, anything, per query",
    payment: {
      protocol: "x402",
      note: "Pay in USDC on Base or Solana — your client picks the rail.",
      facilitator: facilitatorUrl(),
      rails: rails(),
    },
    backend: {
      places: { source: "overpass", live: true, note: "OpenStreetMap Overpass — keyless, called live." },
      reviews: hasYelpKey()
        ? { source: "yelp", live: true }
        : {
            source: "fixture",
            live: false,
            note: "Set YELP_API_KEY for live Yelp ratings and reviews.",
          },
    },
    routes: {
      "GET /search": {
        price: "$0.002",
        params: "lat, lon, radius (m, optional, default 500, max 5000), category, limit",
        returns: "POIs with opening hours, contact, address and OSM tags",
      },
      "GET /detail/:id": {
        price: "$0.002",
        params: "id like 'node-1072800838'",
        returns: "full OSM record + review enrichment",
      },
      "GET /health": { price: "free" },
      "GET /.well-known/x402": { price: "free" },
    },
    docs: "https://nirholas.github.io/x402-places/",
    skill: "https://github.com/nirholas/x402-places/blob/main/skill.md",
  });
});

// Free: health check.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Paid: $0.002 — POI search. Artifact returned in this response body.
app.get("/search", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = req.query.radius != null ? Number(req.query.radius) : 500;
  const limit = req.query.limit != null ? Number(req.query.limit) : 20;
  const category =
    typeof req.query.category === "string" && req.query.category.length > 0
      ? req.query.category
      : null;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    res.status(400).json({
      error: "invalid_lat",
      message: "Query param 'lat' must be a number between -90 and 90.",
    });
    return;
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    res.status(400).json({
      error: "invalid_lon",
      message: "Query param 'lon' must be a number between -180 and 180.",
    });
    return;
  }
  if (!Number.isFinite(radius) || radius <= 0 || radius > 5000) {
    res.status(400).json({
      error: "invalid_radius",
      message: "Query param 'radius' must be a number of metres between 0 and 5000.",
    });
    return;
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
    res.status(400).json({
      error: "invalid_limit",
      message: "Query param 'limit' must be an integer between 1 and 50.",
    });
    return;
  }
  if (category !== null && !/^[a-z0-9_]{1,40}$/.test(category)) {
    res.status(400).json({
      error: "invalid_category",
      message:
        "Query param 'category' must be an OSM tag value such as cafe, restaurant, pharmacy, bar, museum.",
    });
    return;
  }

  try {
    res.json(
      await searchPlaces(lat, lon, Math.round(radius), category, Math.round(limit)),
    );
  } catch (err) {
    res.status(502).json({
      error: "upstream_error",
      message: err instanceof Error ? err.message : "Overpass request failed",
    });
  }
});

// Paid: $0.002 — full place record. Artifact returned in this response body.
app.get("/detail/:id", async (req, res) => {
  const parsed = parsePoiId(req.params.id);
  if (!parsed) {
    res.status(400).json({
      error: "invalid_id",
      message:
        "Path param 'id' must look like 'node-123', 'way-123' or 'relation-123' (as returned by /search).",
    });
    return;
  }
  try {
    const detail = await placeDetail(parsed.osmType, parsed.osmId);
    if (!detail) {
      res.status(404).json({
        error: "not_found",
        message: `No OpenStreetMap ${parsed.osmType} with id ${parsed.osmId}.`,
      });
      return;
    }
    res.json(detail);
  } catch (err) {
    res.status(502).json({
      error: "upstream_error",
      message: err instanceof Error ? err.message : "Overpass request failed",
    });
  }
});

const port = Number(process.env.PORT ?? 4022);
app.listen(port, () => {
  const pkg = require("../package.json") as { version: string };
  console.log(`x402-places v${pkg.version} listening on :${port}`);
  console.log("  payment rails:");
  for (const rail of rails()) {
    console.log(
      `    ${rail.rail === "evm" ? "EVM   " : "Solana"}  ${rail.network.padEnd(14)} ${rail.asset} → ${rail.payTo}`,
    );
  }
  console.log(`  facilitator: ${facilitatorUrl()}`);
  if (usingSuiteDefaultPayTo()) {
    console.log(
      "  note:        using suite default payTo — set PAY_TO_ADDRESS/SOLANA_PAY_TO_ADDRESS to receive funds yourself",
    );
  }
  console.log("  places:      OpenStreetMap Overpass (keyless, live)");
  console.log(
    `  reviews:     ${hasYelpKey() ? "Yelp Fusion (live)" : "fixtures (set YELP_API_KEY for live reviews)"}`,
  );
  console.log("  paid routes:");
  for (const [route, spec] of Object.entries(ROUTES)) {
    console.log(`    ${route.padEnd(28)} ${typeof spec === "string" ? spec : spec.price}`);
  }
  console.log("  free routes: GET /, GET /health, GET /.well-known/x402");
});
