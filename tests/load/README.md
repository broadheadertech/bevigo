# Load Testing with k6

## Overview

We use [k6](https://k6.io) to load-test the bevi&go POS backend (Convex HTTP actions). The primary goal is to ensure the system handles peak coffee-shop traffic (e.g., morning rush) without degraded response times.

## Setup

1. Install k6: https://k6.io/docs/get-started/installation/
2. Ensure the Convex backend is deployed (staging or local dev).

## Sample Script: Order Creation

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // Ramp up to 10 users
    { duration: "1m", target: 10 },   // Stay at 10 users
    { duration: "30s", target: 50 },  // Ramp up to 50 users (morning rush)
    { duration: "2m", target: 50 },   // Sustain 50 users
    { duration: "30s", target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    http_req_failed: ["rate<0.01"],   // Less than 1% failure rate
  },
};

const CONVEX_URL = __ENV.CONVEX_URL || "https://your-deployment.convex.cloud";

export default function () {
  // Step 1: Create an order
  const createPayload = JSON.stringify({
    path: "orders/mutations:createOrder",
    args: {
      token: __ENV.TEST_TOKEN,
      locationId: __ENV.LOCATION_ID,
      items: [
        {
          menuItemId: __ENV.MENU_ITEM_ID,
          quantity: 1,
          unitPrice: 15000, // 150.00 PHP in centavos
          modifiers: [],
        },
      ],
      paymentMethod: "cash",
      notes: "k6 load test order",
    },
  });

  const res = http.post(`${CONVEX_URL}/api/mutation`, createPayload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "order created successfully": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1); // Simulate think time between orders
}
```

## Running

```bash
k6 run --env CONVEX_URL=https://your-deployment.convex.cloud \
       --env TEST_TOKEN=your-test-token \
       --env LOCATION_ID=your-location-id \
       --env MENU_ITEM_ID=your-menu-item-id \
       tests/load/order-load-test.js
```

## Key Metrics to Monitor

- **http_req_duration**: Response time distribution (p50, p95, p99)
- **http_req_failed**: Error rate
- **iterations**: Total completed virtual user iterations
- **vus**: Active virtual users over time

## Target Performance

| Metric | Target |
|--------|--------|
| p95 response time | < 500ms |
| Error rate | < 1% |
| Concurrent users (peak) | 50 |
| Orders per minute (sustained) | 100+ |
