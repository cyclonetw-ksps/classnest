import { describe, expect, it } from "vitest";
import type { PublicConfig } from "../src/shared/types";
import { api, call, FIRST_TEACHER, login, ok } from "./helpers";

describe("網站設定", () => {
  it("公開設定回傳網站標題與 Google 用戶端 ID，不需登入", async () => {
    const res = await call("/api/config");
    expect(res.status).toBe(200);
    const cfg = (await res.json()) as PublicConfig;
    expect(cfg.googleClientId).toBe("test-client.apps.googleusercontent.com");
    expect(typeof cfg.title).toBe("string");
    expect(cfg.title.length).toBeGreaterThan(0);
  });

  it("後台改網站標題後，公開設定的標題跟著改", async () => {
    const c = await login(FIRST_TEACHER);
    await ok(api(c, "PUT", "/api/settings", { title: "小島教室" }));
    const cfg = (await (await call("/api/config")).json()) as PublicConfig;
    expect(cfg.title).toBe("小島教室");
  });

  it("標題不可空白或超過 40 字", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "PUT", "/api/settings", { title: "  " })).status).toBe(400);
    expect((await api(c, "PUT", "/api/settings", { title: "字".repeat(41) })).status).toBe(400);
  });

  it("未登入不能改標題", async () => {
    expect((await call("/api/settings", { method: "PUT", json: { title: "x" } })).status).toBe(401);
  });
});
