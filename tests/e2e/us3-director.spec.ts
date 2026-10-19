import { test, expect } from "@playwright/test";

// US3: 部長の追加承認、BR-014（部長本人申請）、BR-009（経理部長本人申請）の経路
// 本テストは `npm run dev` と組み合わせて `npm run test:e2e` で実行する。

test.describe("US3 部長の追加承認（SC-003 維持）", () => {
  test("佐藤 次郎（E0020、部長）で承認待ち画面を表示できる", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .nth(2)
      .click();
    await page.goto("/approvals");
    await expect(
      page.getByRole("heading", { name: "承認待ち" }),
    ).toBeVisible();
  });

  test("田中 四郎（E0040、経理部長）で承認待ち画面を表示できる", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .nth(4)
      .click();
    await page.goto("/approvals");
    await expect(
      page.getByRole("heading", { name: "承認待ち" }),
    ).toBeVisible();
  });

  test("伊藤 五郎（E0050、経理部長の上位者）で承認待ち画面を表示できる", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "この利用者で入ります" })
      .nth(5)
      .click();
    await page.goto("/approvals");
    await expect(
      page.getByRole("heading", { name: "承認待ち" }),
    ).toBeVisible();
  });
});
