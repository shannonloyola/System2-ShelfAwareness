# Gateway Load Test

This repo now includes a lightweight gateway load test runner that simulates `40` concurrent users by default and sends authenticated requests using either:

- a pre-existing bearer token via `BEARER_TOKEN`
- a generated HS256 JWT via `JWT_SECRET`

## Run

Set the target URL and either a bearer token or JWT secret, then run:

```powershell
$env:GATEWAY_URL="https://<project-ref>.supabase.co/functions/v1/api-gateway"
$env:BEARER_TOKEN="eyJ...existing-access-token..."
$env:GATEWAY_PATH="/api/scm/suppliers"
npm run loadtest:gateway
```

If your project still accepts legacy shared-secret HS256 JWTs, you can use:

```powershell
$env:GATEWAY_URL="https://<project-ref>.supabase.co/functions/v1/api-gateway"
$env:JWT_SECRET="<your-supabase-jwt-secret>"
$env:GATEWAY_PATH="/api/scm/suppliers"
$env:JWT_ROLE="admin"
npm run loadtest:gateway
```

## Optional settings

```powershell
$env:CONCURRENCY="40"
$env:DURATION_SECONDS="30"
$env:REQUEST_TIMEOUT_MS="10000"
$env:P95_THRESHOLD_MS="1000"
$env:ERROR_RATE_THRESHOLD="0.01"
$env:JWT_ROLE="admin"
```

If you need a different route, set `GATEWAY_PATH` to one of the routes allowed by your gateway, for example:

- `/api/scm/procurement`
- `/api/scm/suppliers`
- `/api/scm/shipments`
- `/api/scm/quality`

When using `JWT_SECRET`, match `JWT_ROLE` to a role that the chosen route accepts.

When using `BEARER_TOKEN`, the role comes from the token itself.

## Done-When guide

For the task `Load test gateway under 40 concurrent users`, a practical pass condition is:

- `CONCURRENCY=40`
- stable `2xx` or expected upstream responses
- low error rate, ideally `0%`
- `P95` latency stays under your team target

The script exits with a non-zero code when:

- error rate is above `ERROR_RATE_THRESHOLD`
- `P95` latency is above `P95_THRESHOLD_MS`

## Likely bottleneck in the current gateway

In the gateway code you shared, `crypto.subtle.importKey(...)` runs on every request inside `verifyJwt`. That adds avoidable work directly on the auth hot path.

Use a cached promise instead, so the HMAC key is imported once per edge function instance:

```ts
let jwtKeyPromise: Promise<CryptoKey> | null = null;

function getJwtKey(secret: string) {
  if (!jwtKeyPromise) {
    jwtKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }

  return jwtKeyPromise;
}

async function verifyJwt(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToUint8Array(signatureB64);
  const cryptoKey = await getJwtKey(secret);

  const ok = await crypto.subtle.verify("HMAC", cryptoKey, signature, data);
  if (!ok) {
    throw new Error("Invalid JWT signature");
  }

  const payload = decodeJwtPayload(token);
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error("JWT expired");
  }

  return payload;
}
```

That change does not remove JWT verification. It just avoids repeating the expensive key import for every request.
