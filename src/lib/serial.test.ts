import { describe, expect, it } from "vitest";
import { createSerialQueue } from "./serial";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("createSerialQueue", () => {
  it("渡した順に直列実行する（前の完了まで次を開始しない）", async () => {
    const run = createSerialQueue();
    const events: string[] = [];

    const first = run(async () => {
      events.push("first:start");
      await tick();
      await tick();
      events.push("first:end");
      return 1;
    });
    const second = run(async () => {
      events.push("second:start");
      return 2;
    });

    expect(await first).toBe(1);
    expect(await second).toBe(2);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("失敗は呼び出し元に伝播し、後続はそのまま実行される", async () => {
    const run = createSerialQueue();

    const failing = run(async () => {
      throw new Error("boom");
    });
    const after = run(async () => "ok");

    await expect(failing).rejects.toThrow("boom");
    expect(await after).toBe("ok");
  });

  it("結果を誰も受け取らない失敗タスクでも unhandledRejection を発生させない", async () => {
    // chain = next.catch(() => {}) のガードが消える（chain = next になる）と
    // fire-and-forget された失敗 Promise が誰にも処理されず unhandledRejection に
    // なる。ミューテーションでこのテストだけが落ちることを確認済み。
    const run = createSerialQueue();
    let unhandled = 0;
    const onUnhandled = () => {
      unhandled += 1;
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      // 戻り値をあえて受け取らない
      void run(async () => {
        throw new Error("boom");
      });
      // unhandledRejection の判定はイベントループを跨いだ後に行われる
      await new Promise<void>((r) => setTimeout(r, 20));
      expect(unhandled).toBe(0);
      // キューも止まっていない
      expect(await run(async () => "ok")).toBe("ok");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("各呼び出しの戻り値がそれぞれ正しく返る", async () => {
    const run = createSerialQueue();
    const results = await Promise.all([
      run(async () => "a"),
      run(async () => "b"),
      run(async () => "c"),
    ]);
    expect(results).toEqual(["a", "b", "c"]);
  });
});
