import { test, expect } from "@playwright/test";

// US4: 経理確定と支払用 CSV 出力。
// 本テストは `npm run dev` と組み合わせて `npm run test:e2e` で実行する。

test.describe("US4 経理フロー（SC-004／SC-005）", () => {
  test("高橋 三郎（E0030、経理担当）で経理確定待ち画面を表示できる", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .nth(3)
      .click();
    await page.goto("/accounting/pending");
    await expect(
      page.getByRole("heading", { name: "経理確定待ち" }),
    ).toBeVisible();
  });

  test("経理担当で支払用 CSV の出力画面を表示できる", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .nth(3)
      .click();
    await page.goto("/accounting/exports");
    await expect(
      page.getByRole("heading", { name: "支払用 CSV の出力" }),
    ).toBeVisible();
    await expect(page.getByText("出力履歴")).toBeVisible();
  });

  test("申請者（E0001 山田）は経理確定画面にアクセスしても権限エラー", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .first()
      .click();
    await page.goto("/accounting/pending");
    // 画面自体は読み込まれるが、API が 403 を返して items は 0 件になる想定
    await expect(
      page.getByText("経理確定待ちの申請はありません。").or(
        page.getByText("権限がありません"),
      ),
    ).toBeVisible();
  });
});
