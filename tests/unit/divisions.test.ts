import { describe, it, expect } from "vitest";
import {
  getDivisionNumber,
  getDivisionName,
  isFirstOfDivision,
  isTopThree,
  getPlayerStyle,
  PLAYERS_PER_DIVISION,
} from "@/lib/divisions";

describe("Divisões — agrupamento de jogadores", () => {
  it("posições 1–6 ficam na Divisão 1", () => {
    for (let p = 1; p <= 6; p++) {
      expect(getDivisionNumber(p)).toBe(1);
    }
  });

  it("posições 7–12 ficam na Divisão 2", () => {
    for (let p = 7; p <= 12; p++) {
      expect(getDivisionNumber(p)).toBe(2);
    }
  });

  it("Top 3 é destacado", () => {
    expect(isTopThree(1)).toBe(true);
    expect(isTopThree(3)).toBe(true);
    expect(isTopThree(4)).toBe(false);
  });

  it("isFirstOfDivision detecta corretamente o início de cada divisão", () => {
    expect(isFirstOfDivision(1)).toBe(true);
    expect(isFirstOfDivision(PLAYERS_PER_DIVISION + 1)).toBe(true);
    expect(isFirstOfDivision(2)).toBe(false);
  });

  it("getPlayerStyle aplica estilo especial no top 3 e estilo de divisão depois", () => {
    expect(getPlayerStyle(1).name).toMatch(/Top/);
    expect(getPlayerStyle(7).name).toMatch(/Divisão 2/);
  });

  it("getDivisionName devolve nome consistente", () => {
    expect(getDivisionName(1)).toBe("Divisão 1");
    expect(getDivisionName(8)).toBe("Divisão 2");
    expect(getDivisionName(100)).toMatch(/Divisão/);
  });
});
