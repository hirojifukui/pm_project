// 金額値オブジェクト。
// 旅費精算は円単位の整数で管理し、計算の途中で浮動小数点に落とさない（憲法 追加の制約）。
// 丸めは「切り捨て（floor）」を既定とし、本モジュールの関数経由で一箇所に集約する。

export class Amount {
  private readonly yen: number;

  private constructor(yen: number) {
    this.yen = yen;
  }

  static fromYen(input: number): Amount {
    if (!Number.isFinite(input)) {
      throw new Error("金額は有限の数値でなければなりません");
    }
    if (!Number.isInteger(input)) {
      throw new Error("金額は円単位の整数で指定してください");
    }
    if (input < 0) {
      throw new Error("金額は 0 円以上で指定してください");
    }
    return new Amount(input);
  }

  static zero(): Amount {
    return new Amount(0);
  }

  toYen(): number {
    return this.yen;
  }

  add(other: Amount): Amount {
    return new Amount(this.yen + other.yen);
  }

  subtract(other: Amount): Amount {
    if (this.yen < other.yen) {
      throw new Error("金額の減算結果が負の数になります");
    }
    return new Amount(this.yen - other.yen);
  }

  multiplyByInt(n: number): Amount {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error("金額に掛ける係数は 0 以上の整数でなければなりません");
    }
    return new Amount(this.yen * n);
  }

  isGreaterThan(other: Amount): boolean {
    return this.yen > other.yen;
  }

  isLessThan(other: Amount): boolean {
    return this.yen < other.yen;
  }

  equals(other: Amount): boolean {
    return this.yen === other.yen;
  }
}

/**
 * 丸め方針: 切り捨て（floor）。消費税や日当上限の端数処理はここに集約する。
 */
export function floorToYen(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("丸め対象は有限の数値でなければなりません");
  }
  return Math.floor(value);
}

export function sumAmounts(amounts: Iterable<Amount>): Amount {
  let total = Amount.zero();
  for (const a of amounts) {
    total = total.add(a);
  }
  return total;
}
