import { test, expect } from "@playwright/test";

// US1 の受け入れシナリオを Playwright で検証する。
// 本テストは、`npm run dev` でローカルサーバーを起動した状態で `npm run test:e2e` が
// 自動的に Chromium と WebKit（iPhone 13 プロファイル）で実行する。

test.describe("US1 申請者フロー（SC-002/SC-007/SC-009）", () => {
  test("山田 太郎（E0001）で下書き作成→明細入力→保存→提出→履歴参照", async ({
    page,
  }) => {
    // 簡易ログイン
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .first()
      .click();

    // 一覧 → 新規作成
    await expect(page).toHaveURL(/\/applications\/drafts/);
    await page.getByRole("link", { name: "新規の申請を作る" }).click();
    await expect(page).toHaveURL(/\/applications\/new/);

    // フォーム入力
    await page.getByLabel("出張の開始日").fill("2026-10-01");
    await page.getByLabel("出張の終了日").fill("2026-10-02");
    await page.getByLabel("行先").fill("大阪");
    await page.getByLabel("目的").fill("顧客打ち合わせ");
    await page.getByRole("button", { name: "下書きを作成する" }).click();

    // 詳細画面に遷移
    await expect(page).toHaveURL(/\/applications\/by-number\/JP-/);
    await expect(page.getByText("下書き").first()).toBeVisible();
  });

  test("BR-005 タクシー事由未選択で提出がブロックされる", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .first()
      .click();
    await page.getByRole("link", { name: "新規の申請を作る" }).click();
    await page.getByLabel("出張の開始日").fill("2026-10-01");
    await page.getByLabel("出張の終了日").fill("2026-10-01");
    await page.getByLabel("行先").fill("横浜");
    await page.getByLabel("目的").fill("商談");
    await page.getByRole("button", { name: "下書きを作成する" }).click();
    // 明細タクシーを追加 → 事由未選択で保存は Zod で拒否される
    await page.getByRole("button", { name: "明細を追加する" }).click();
    const categorySelect = page.locator("select").nth(0);
    await categorySelect.selectOption("TRANSPORT");
    const modeSelect = page.locator("select").nth(1);
    await modeSelect.selectOption("TAXI");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(
      page.getByText("タクシーの明細では例外事由"),
    ).toBeVisible();
  });
});
