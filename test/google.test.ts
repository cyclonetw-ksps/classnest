import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetJwksCache, JwksUnavailableError, verifyGoogleIdToken } from "../src/worker/google";
import { call, googleToken } from "./helpers";

const CLIENT = "test-client.apps.googleusercontent.com";
const JWKS = "https://www.googleapis.com/oauth2/v3/certs";

// 只攔這個測試檔的 fetch：數 Google JWKS 被抓幾次，需要時讓它失敗
let jwksFetches = 0;
let jwksFails = false;
const realFetch = globalThis.fetch;
beforeEach(() => {
  jwksFetches = 0;
  jwksFails = false;
  _resetJwksCache();
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === JWKS) {
      jwksFetches++;
      if (jwksFails) return Promise.resolve(new Response("unavailable", { status: 503 }));
    }
    return realFetch(input, init);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  _resetJwksCache();
});

describe("Google 公開金鑰（JWKS）", () => {
  it("帶陌生 kid 的 token 不會每次都逼伺服器去抓 Google", async () => {
    expect(await verifyGoogleIdToken(await googleToken("a@school.test"), CLIENT)).not.toBeNull();
    expect(jwksFetches).toBe(1);
    for (let i = 0; i < 5; i++) {
      expect(await verifyGoogleIdToken(await googleToken("a@school.test", {}, { kid: `random-${i}` }), CLIENT)).toBeNull();
    }
    expect(jwksFetches).toBe(1);
  });

  it("快取是空的時候，第一次遇到陌生 kid 照常抓一次", async () => {
    expect(await verifyGoogleIdToken(await googleToken("b@school.test", {}, { kid: "random" }), CLIENT)).toBeNull();
    expect(jwksFetches).toBe(1);
    expect(await verifyGoogleIdToken(await googleToken("b@school.test"), CLIENT)).not.toBeNull();
    expect(jwksFetches).toBe(1);
  });

  it("抓不到 Google 公開金鑰時丟出 JwksUnavailableError，登入回 503", async () => {
    jwksFails = true;
    await expect(verifyGoogleIdToken(await googleToken("c@school.test"), CLIENT)).rejects.toBeInstanceOf(JwksUnavailableError);
    const res = await call("/api/auth/google", { method: "POST", json: { credential: await googleToken("c@school.test") } });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/Google.*稍後再試/);
  });
});
