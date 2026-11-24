import { generateKeyPairSync } from "node:crypto";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// 測試用的「假 Google」金鑰：私鑰給測試簽 ID token，公鑰由攔截的 JWKS 網址送出
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-kid";
const privateJwk = { ...privateKey.export({ format: "jwk" }), kid: KID, alg: "RS256" };
const publicJwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
          FIRST_TEACHER_EMAIL: "First@School.test",
          TEST_GOOGLE_PRIVATE_JWK: JSON.stringify(privateJwk),
        },
        outboundService: (req: Request) => {
          const url = new URL(req.url);
          if (url.hostname === "www.googleapis.com" && url.pathname === "/oauth2/v3/certs") {
            return Response.json({ keys: [publicJwk] }, { headers: { "cache-control": "public, max-age=3600" } });
          }
          return new Response("not found", { status: 404 });
        },
      },
    }),
  ],
  test: { include: ["test/**/*.test.ts"] },
});
