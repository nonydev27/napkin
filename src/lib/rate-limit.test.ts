import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryRateLimiter,
  getClientIp,
  getRateLimitConfig,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHeaders,
  rateLimitKey,
} from "./rate-limit.ts";

test("allows requests under the limit", () => {
  const limiter = createMemoryRateLimiter(() => 0);
  const result = limiter.consume("anon:203.0.113.5", 5);

  assert.equal(result.allowed, true);
  assert.equal(result.limit, 5);
  assert.equal(result.remaining, 4);
});

test("allows the request that reaches the limit", () => {
  const limiter = createMemoryRateLimiter(() => 0);
  for (let i = 0; i < 4; i += 1) limiter.consume("anon:203.0.113.5", 5);

  const atLimit = limiter.consume("anon:203.0.113.5", 5);
  assert.equal(atLimit.allowed, true);
  assert.equal(atLimit.remaining, 0);
});

test("blocks requests over the limit", () => {
  const limiter = createMemoryRateLimiter(() => 0);
  for (let i = 0; i < 5; i += 1) limiter.consume("anon:203.0.113.5", 5);

  const overLimit = limiter.consume("anon:203.0.113.5", 5);
  assert.equal(overLimit.allowed, false);
  assert.equal(overLimit.remaining, 0);
  assert.ok(overLimit.retryAfterSeconds > 0);
});

test("resets the counter once the window expires", () => {
  let now = 0;
  const limiter = createMemoryRateLimiter(() => now);
  for (let i = 0; i < 5; i += 1) limiter.consume("anon:203.0.113.5", 5);
  assert.equal(limiter.consume("anon:203.0.113.5", 5).allowed, false);

  now = RATE_LIMIT_WINDOW_MS + 1;
  const afterReset = limiter.consume("anon:203.0.113.5", 5);
  assert.equal(afterReset.allowed, true);
  assert.equal(afterReset.remaining, 4);
});

test("keeps anonymous and signed-in counters separate", () => {
  const limiter = createMemoryRateLimiter(() => 0);
  const anonKey = rateLimitKey("anon", "203.0.113.5");
  const userKey = rateLimitKey("user", "7d2f4b2c-0000-4000-8000-000000000000");

  for (let i = 0; i < 5; i += 1) limiter.consume(anonKey, 5);
  assert.equal(limiter.consume(anonKey, 5).allowed, false);

  const user = limiter.consume(userKey, 30);
  assert.equal(user.allowed, true);
  assert.equal(user.remaining, 29);
});

test("reads the first address from x-forwarded-for", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
  assert.equal(getClientIp(headers), "203.0.113.5");
});

test("falls back to x-real-ip and then to unknown", () => {
  assert.equal(getClientIp(new Headers({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  assert.equal(getClientIp(new Headers()), "unknown");
});

test("uses documented defaults and honours environment overrides", (t) => {
  const originalAnon = process.env.RATE_LIMIT_ANON_PER_HOUR;
  const originalUser = process.env.RATE_LIMIT_USER_PER_HOUR;
  t.after(() => {
    if (originalAnon === undefined) delete process.env.RATE_LIMIT_ANON_PER_HOUR;
    else process.env.RATE_LIMIT_ANON_PER_HOUR = originalAnon;
    if (originalUser === undefined) delete process.env.RATE_LIMIT_USER_PER_HOUR;
    else process.env.RATE_LIMIT_USER_PER_HOUR = originalUser;
  });

  delete process.env.RATE_LIMIT_ANON_PER_HOUR;
  delete process.env.RATE_LIMIT_USER_PER_HOUR;
  assert.deepEqual(getRateLimitConfig(), { anon: 5, user: 30 });

  process.env.RATE_LIMIT_ANON_PER_HOUR = "10";
  process.env.RATE_LIMIT_USER_PER_HOUR = "99";
  assert.deepEqual(getRateLimitConfig(), { anon: 10, user: 99 });

  process.env.RATE_LIMIT_ANON_PER_HOUR = "not-a-number";
  assert.equal(getRateLimitConfig().anon, 5);
});

test("exposes limit headers for every response", () => {
  const limiter = createMemoryRateLimiter(() => 0);
  const result = limiter.consume("anon:203.0.113.5", 5);

  assert.deepEqual(rateLimitHeaders(result), {
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": "4",
  });
});
