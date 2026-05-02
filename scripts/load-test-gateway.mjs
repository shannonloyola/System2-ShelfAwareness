import crypto from "node:crypto";
import process from "node:process";

const gatewayBaseUrl = process.env.GATEWAY_URL;
const jwtSecret = process.env.JWT_SECRET;
const bearerToken = process.env.BEARER_TOKEN;
const routePath = process.env.GATEWAY_PATH ?? "/api/scm/suppliers";
const httpMethod = (process.env.HTTP_METHOD ?? "GET").toUpperCase();
const concurrency = Number(process.env.CONCURRENCY ?? 40);
const durationSeconds = Number(process.env.DURATION_SECONDS ?? 30);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 10000);
const expectedRole = process.env.JWT_ROLE ?? "admin";
const userId = process.env.JWT_SUB ?? "load-test-user";
const userEmail = process.env.JWT_EMAIL ?? "loadtest@example.com";
const p95ThresholdMs = Number(process.env.P95_THRESHOLD_MS ?? 1000);
const errorRateThreshold = Number(process.env.ERROR_RATE_THRESHOLD ?? 0.01);
const postBody = process.env.REQUEST_BODY;

if (!gatewayBaseUrl) {
  console.error("Missing GATEWAY_URL environment variable.");
  process.exit(1);
}

if (!jwtSecret && !bearerToken) {
  console.error("Provide either JWT_SECRET or BEARER_TOKEN.");
  process.exit(1);
}

if (gatewayBaseUrl.includes("<") || gatewayBaseUrl.includes(">")) {
  console.error(
    "GATEWAY_URL still contains placeholder characters. Replace it with your real Supabase Edge Function URL.",
  );
  process.exit(1);
}

if (!Number.isFinite(concurrency) || concurrency <= 0) {
  console.error("CONCURRENCY must be a positive number.");
  process.exit(1);
}

if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
  console.error("DURATION_SECONDS must be a positive number.");
  process.exit(1);
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createJwt(secret, role) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    email: userEmail,
    role,
    app_metadata: { role },
    iat: now,
    exp: now + Math.max(durationSeconds + 60, 120),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${data}.${signature}`;
}

function percentile(sortedValues, percentileRank) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentileRank / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(index, 0)];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function buildTargetUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

const jwt = bearerToken ?? createJwt(jwtSecret, expectedRole);
let targetUrl;

try {
  targetUrl = buildTargetUrl(gatewayBaseUrl, routePath);
  new URL(targetUrl);
} catch (error) {
  console.error("Invalid gateway URL configuration.");
  console.error(`GATEWAY_URL=${gatewayBaseUrl}`);
  console.error(`GATEWAY_PATH=${routePath}`);
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${jwt}`,
  "Content-Type": "application/json",
};

const metrics = {
  totalRequests: 0,
  successCount: 0,
  failureCount: 0,
  statusCounts: new Map(),
  latencies: [],
  errors: [],
};

let keepRunning = true;
setTimeout(() => {
  keepRunning = false;
}, durationSeconds * 1000);

async function doRequest(workerId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(targetUrl, {
      method: httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(httpMethod) ? undefined : postBody ?? "{}",
      signal: controller.signal,
    });

    const elapsedMs = performance.now() - startedAt;
    metrics.totalRequests += 1;
    metrics.latencies.push(elapsedMs);
    metrics.statusCounts.set(
      response.status,
      (metrics.statusCounts.get(response.status) ?? 0) + 1,
    );

    if (response.ok) {
      metrics.successCount += 1;
      return;
    }

    metrics.failureCount += 1;
    const bodyText = await response.text();
    metrics.errors.push(
      `worker=${workerId} status=${response.status} body=${bodyText.slice(0, 200)}`,
    );
  } catch (error) {
    const elapsedMs = performance.now() - startedAt;
    metrics.totalRequests += 1;
    metrics.failureCount += 1;
    metrics.latencies.push(elapsedMs);
    metrics.errors.push(
      `worker=${workerId} error=${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function worker(workerId) {
  while (keepRunning) {
    await doRequest(workerId);
  }
}

console.log("Starting gateway load test...");
console.log(
  JSON.stringify(
    {
      targetUrl,
      method: httpMethod,
      concurrency,
      durationSeconds,
      requestTimeoutMs,
      expectedRole,
      p95ThresholdMs,
      errorRateThreshold,
    },
    null,
    2,
  ),
);

const startedAt = Date.now();
await Promise.all(
  Array.from({ length: concurrency }, (_, index) => worker(index + 1)),
);
const actualDurationSeconds = (Date.now() - startedAt) / 1000;

const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
const averageLatencyMs =
  metrics.latencies.reduce((sum, value) => sum + value, 0) /
  Math.max(metrics.latencies.length, 1);
const p50LatencyMs = percentile(sortedLatencies, 50);
const p95LatencyMs = percentile(sortedLatencies, 95);
const p99LatencyMs = percentile(sortedLatencies, 99);
const maxLatencyMs = sortedLatencies[sortedLatencies.length - 1] ?? 0;
const requestsPerSecond =
  metrics.totalRequests / Math.max(actualDurationSeconds, 1);
const errorRate =
  metrics.failureCount / Math.max(metrics.totalRequests, 1);

console.log("");
console.log("Gateway load test summary");
console.log("=========================");
console.log(`Total requests : ${metrics.totalRequests}`);
console.log(`Success count  : ${metrics.successCount}`);
console.log(`Failure count  : ${metrics.failureCount}`);
console.log(`Error rate     : ${round(errorRate * 100)}%`);
console.log(`Throughput     : ${round(requestsPerSecond)} req/s`);
console.log(`Avg latency    : ${round(averageLatencyMs)} ms`);
console.log(`P50 latency    : ${round(p50LatencyMs)} ms`);
console.log(`P95 latency    : ${round(p95LatencyMs)} ms`);
console.log(`P99 latency    : ${round(p99LatencyMs)} ms`);
console.log(`Max latency    : ${round(maxLatencyMs)} ms`);
console.log("");
console.log("HTTP status counts");
for (const [status, count] of [...metrics.statusCounts.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`${status} -> ${count}`);
}

if (metrics.errors.length > 0) {
  console.log("");
  console.log("Sample errors");
  for (const error of metrics.errors.slice(0, 10)) {
    console.log(error);
  }
}

const thresholdFailures = [];

if (errorRate > errorRateThreshold) {
  thresholdFailures.push(
    `Error rate ${round(errorRate * 100)}% exceeded threshold ${round(errorRateThreshold * 100)}%`,
  );
}

if (p95LatencyMs > p95ThresholdMs) {
  thresholdFailures.push(
    `P95 latency ${round(p95LatencyMs)} ms exceeded threshold ${round(p95ThresholdMs)} ms`,
  );
}

if (thresholdFailures.length > 0) {
  console.error("");
  console.error("Threshold check failed:");
  for (const failure of thresholdFailures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("");
console.log("Threshold check passed.");
