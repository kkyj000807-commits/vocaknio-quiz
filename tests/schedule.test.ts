import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── AsyncStorage 인메모리 모킹 ────────────────────────────────────────────────
const mem = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

import {
  loadSchedules,
  addSchedule,
  updateSchedule,
  toggleSchedule,
  removeSchedule,
  clearDoneSchedules,
} from "@/lib/store";

beforeEach(() => {
  mem.clear();
});

describe("학습 일정 store", () => {
  it("빈 상태에서 빈 배열을 반환한다", async () => {
    expect(await loadSchedules()).toEqual([]);
  });

  it("일정을 추가하면 trim·정규화되어 저장된다", async () => {
    const list = await addSchedule({
      title: "  동의어 복습  ",
      date: "2026-07-01",
      time: " 09:30 ",
      memo: "",
    });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("동의어 복습");
    expect(list[0].time).toBe("09:30");
    expect(list[0].memo).toBeUndefined();
    expect(list[0].done).toBe(false);
    expect(list[0].id).toBeTruthy();
  });

  it("날짜·시간 순으로 정렬한다 (시간 없는 일정은 뒤로)", async () => {
    await addSchedule({ title: "B", date: "2026-07-02" });
    await addSchedule({ title: "A-late", date: "2026-07-01", time: "18:00" });
    await addSchedule({ title: "A-early", date: "2026-07-01", time: "08:00" });
    await addSchedule({ title: "A-notime", date: "2026-07-01" });
    const list = await loadSchedules();
    expect(list.map((i) => i.title)).toEqual(["A-early", "A-late", "A-notime", "B"]);
  });

  it("완료 상태를 토글한다", async () => {
    const [item] = await addSchedule({ title: "X", date: "2026-07-01" });
    let list = await toggleSchedule(item.id);
    expect(list[0].done).toBe(true);
    list = await toggleSchedule(item.id);
    expect(list[0].done).toBe(false);
  });

  it("일정을 수정한다", async () => {
    const [item] = await addSchedule({ title: "old", date: "2026-07-01" });
    const list = await updateSchedule(item.id, { title: "new", time: "10:00" });
    expect(list[0].title).toBe("new");
    expect(list[0].time).toBe("10:00");
  });

  it("빈 문자열로 수정하면 time/memo가 제거된다", async () => {
    const [item] = await addSchedule({
      title: "X",
      date: "2026-07-01",
      time: "10:00",
      memo: "메모",
    });
    const list = await updateSchedule(item.id, { time: "", memo: "" });
    expect(list[0].time).toBeUndefined();
    expect(list[0].memo).toBeUndefined();
  });

  it("일정을 삭제한다", async () => {
    const [a] = await addSchedule({ title: "A", date: "2026-07-01" });
    await addSchedule({ title: "B", date: "2026-07-02" });
    const list = await removeSchedule(a.id);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("B");
  });

  it("완료된 일정만 일괄 정리한다", async () => {
    const [a] = await addSchedule({ title: "A", date: "2026-07-01" });
    await addSchedule({ title: "B", date: "2026-07-02" });
    await toggleSchedule(a.id);
    const list = await clearDoneSchedules();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("B");
    expect(list[0].done).toBe(false);
  });
});
