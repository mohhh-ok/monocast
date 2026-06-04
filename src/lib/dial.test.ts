import { describe, expect, it } from "vitest";
import { FM_MAX, FM_MIN, playbackProgress, progressToFrequency } from "./dial";

describe("playbackProgress", () => {
  it("先頭セグメントの先頭は 0", () => {
    expect(playbackProgress(0, 0, 4)).toBe(0);
  });

  it("セグメント位置とセグメント内進捗を合成する", () => {
    // 4 セグメント中 2 本目の半分 = (1 + 0.5) / 4
    expect(playbackProgress(1, 0.5, 4)).toBeCloseTo(0.375, 10);
  });

  it("最終セグメントの末尾は 1", () => {
    expect(playbackProgress(3, 1, 4)).toBe(1);
  });

  it("セグメント内進捗は 0..1 にクランプされる", () => {
    expect(playbackProgress(0, -0.5, 4)).toBe(0);
    expect(playbackProgress(0, 1.5, 4)).toBeCloseTo(0.25, 10);
  });

  it("segIndex がセグメント数以上でも 1 を超えない", () => {
    expect(playbackProgress(4, 0.5, 4)).toBe(1);
  });

  it("segIndex が負でも 0 を下回らない", () => {
    expect(playbackProgress(-1, 0, 4)).toBe(0);
  });

  it("セグメント数 0 のときは 0", () => {
    expect(playbackProgress(0, 0.5, 0)).toBe(0);
  });
});

describe("progressToFrequency", () => {
  it("進捗 0 は FM 帯の下限", () => {
    expect(progressToFrequency(0)).toBe(FM_MIN);
  });

  it("進捗 1 は FM 帯の上限", () => {
    expect(progressToFrequency(1)).toBe(FM_MAX);
  });

  it("中間は線形補間で 0.1 MHz 単位に丸める", () => {
    // 76 + 0.5 * (95 - 76) = 85.5
    expect(progressToFrequency(0.5)).toBe(85.5);
  });

  it("丸め誤差が出る進捗でも小数第 1 位に収まる", () => {
    const freq = progressToFrequency(1 / 3);
    expect(freq).toBe(Math.round((FM_MIN + (FM_MAX - FM_MIN) / 3) * 10) / 10);
  });

  it("範囲外の進捗はクランプされる", () => {
    expect(progressToFrequency(-1)).toBe(FM_MIN);
    expect(progressToFrequency(2)).toBe(FM_MAX);
  });
});
