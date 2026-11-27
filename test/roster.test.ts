import { describe, expect, it } from "vitest";
import type { Group, Student } from "../src/shared/types";
import { api, FIRST_TEACHER, login, ok, state } from "./helpers";

async function newGroup(cookie: string, name: string) {
  return ok(api<Group>(cookie, "POST", "/api/groups", { name }));
}

async function newStudent(cookie: string, displayName: string, groupIds: string[] = [], extra: Partial<Student> = {}) {
  return ok(api<Student>(cookie, "POST", "/api/students", { displayName, homeClass: "五年一班", homeroomTeacher: "王老師", groupIds, ...extra }));
}

describe("學生名單", () => {
  it("新增學生只存顯示名、原班、導師稱呼、組別", async () => {
    const c = await login(FIRST_TEACHER);
    const s = await newStudent(c, "王〇明", [], { birthday: "2015-01-01", parentPhone: "0912" } as never);
    const found = (await state(c)).students.find((x) => x.id === s.id)!;
    expect(found.displayName).toBe("王〇明");
    expect(found.homeClass).toBe("五年一班");
    expect(found.homeroomTeacher).toBe("王老師");
    // hasCards 只是「老師產生過圖卡密碼沒有」，不是個資；密碼本身不在名單裡
    expect(Object.keys(found).sort()).toEqual(["active", "displayName", "groupIds", "hasCards", "homeClass", "homeroomTeacher", "id", "rewards", "total"]);
  });

  it("可以改名、停用、再啟用", async () => {
    const c = await login(FIRST_TEACHER);
    const s = await newStudent(c, "改名前");
    await ok(api(c, "PATCH", `/api/students/${s.id}`, { displayName: "改名後" }));
    let found = (await state(c)).students.find((x) => x.id === s.id)!;
    expect(found.displayName).toBe("改名後");
    await ok(api(c, "PATCH", `/api/students/${s.id}`, { active: false }));
    found = (await state(c)).students.find((x) => x.id === s.id)!;
    expect(found.active).toBe(false);
    await ok(api(c, "PATCH", `/api/students/${s.id}`, { active: true }));
    found = (await state(c)).students.find((x) => x.id === s.id)!;
    expect(found.active).toBe(true);
  });

  it("顯示名不可空白或超過 20 字", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "POST", "/api/students", { displayName: "   " })).status).toBe(400);
    expect((await api(c, "POST", "/api/students", { displayName: "字".repeat(21) })).status).toBe(400);
  });

  it("找不到的學生回 404", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "PATCH", "/api/students/nope", { displayName: "x" })).status).toBe(404);
  });
});

describe("組別", () => {
  it("同一位學生可以同時屬於兩個以上的組，從任一組都看得到他", async () => {
    const c = await login(FIRST_TEACHER);
    const chinese = await newGroup(c, "國語五年級組");
    const math = await newGroup(c, "數學三年級組");
    const s = await newStudent(c, "多組學生", [chinese.id, math.id]);
    const st = await state(c);
    const found = st.students.find((x) => x.id === s.id)!;
    expect(found.groupIds.sort()).toEqual([chinese.id, math.id].sort());
    const inChinese = st.students.filter((x) => x.groupIds.includes(chinese.id)).map((x) => x.id);
    const inMath = st.students.filter((x) => x.groupIds.includes(math.id)).map((x) => x.id);
    expect(inChinese).toContain(s.id);
    expect(inMath).toContain(s.id);
  });

  it("可以改組別成員與組名，也可以停用組", async () => {
    const c = await login(FIRST_TEACHER);
    const g1 = await newGroup(c, "甲組");
    const g2 = await newGroup(c, "乙組");
    const s = await newStudent(c, "換組學生", [g1.id]);
    await ok(api(c, "PATCH", `/api/students/${s.id}`, { groupIds: [g2.id] }));
    await ok(api(c, "PATCH", `/api/groups/${g2.id}`, { name: "乙組（改）" }));
    await ok(api(c, "PATCH", `/api/groups/${g1.id}`, { active: false }));
    const st = await state(c);
    expect(st.students.find((x) => x.id === s.id)!.groupIds).toEqual([g2.id]);
    expect(st.groups.find((g) => g.id === g2.id)!.name).toBe("乙組（改）");
    expect(st.groups.find((g) => g.id === g1.id)!.active).toBe(false);
  });

  it("指定不存在的組別會被拒絕", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "POST", "/api/students", { displayName: "x", groupIds: ["missing"] })).status).toBe(400);
  });

  it("組名不可空白", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "POST", "/api/groups", { name: "" })).status).toBe(400);
  });
});
