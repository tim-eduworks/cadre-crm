import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "dev.admin@eduworks.com") {
  await page.goto("/login");
  await page.getByLabel("Dev login (local only)").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible();
}

test("signed-out visitors are sent to login, and other domains are refused", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Dev login (local only)").fill("someone@example.com");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await expect(page.getByText("Only eduworks.com Workspace accounts")).toBeVisible();
});

test("pipeline board shows 12 stages, cards with scorecard dots, and totals", async ({ page }) => {
  await login(page);
  await expect(page.locator("[data-stage]")).toHaveCount(12);
  const card = page.getByTestId("opp-card").filter({ hasText: "Fleet training readiness dashboard" });
  await expect(card).toBeVisible();
  await expect(card.locator("[data-rating]")).toHaveCount(8);
  await expect(card).toContainText("$2.1M");
  await expect(page.getByTestId("summary")).toContainText("Untimed");
  await expect(page.getByText("Not for CUI or classified information.")).toBeVisible();
  // No single percentage anywhere on the board.
  await expect(page.locator("main")).not.toContainText("%");
});

test("a blocked forward move lists the unmet gate items; a member can't override", async ({ page }) => {
  await login(page, "dev.bd@eduworks.com");
  const card = page.getByTestId("opp-card").filter({ hasText: "Apprenticeship skills framework" });
  await card.dragTo(page.locator('[data-stage="3"]'));
  const unmet = page.getByTestId("unmet-gates");
  await expect(unmet).toContainText("Problem statement: Problem and Impact filled");
  await expect(unmet).toContainText("Discovery notes doc linked");
  await expect(page.getByRole("button", { name: "Override gate" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator('[data-stage="1"]').getByRole("link", { name: "Apprenticeship skills framework" })).toBeVisible();
});

test("filters narrow the board", async ({ page }) => {
  await login(page);
  await page.getByLabel("Confidence tier").selectOption("Committed");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("opp-card")).toHaveCount(2);
  await expect(page.getByTestId("opp-card").first()).toContainText("Instructor qualification tracking");
});

test("moving back needs a reason, and an admin can override a gate with a comment; both are logged", async ({ page }) => {
  await login(page);
  const name = "Technician upskilling pathways"; // seeded at stage 3 with an incomplete scorecard
  const card = () => page.getByTestId("opp-card").filter({ hasText: name });

  await card().dragTo(page.locator('[data-stage="4"]'));
  await expect(page.getByTestId("unmet-gates")).toContainText("All 8 scorecard criteria rated");
  await expect(page.getByRole("button", { name: "Override gate" })).toBeDisabled();
  await page.getByLabel(/Admin override/).fill("e2e: leadership approved early design work");
  await page.getByRole("button", { name: "Override gate" }).click();
  await expect(page.locator('[data-stage="4"]').getByRole("link", { name })).toBeVisible();

  await card().dragTo(page.locator('[data-stage="3"]'));
  await expect(page.getByRole("button", { name: "Move back" })).toBeDisabled();
  await page.getByLabel("Reason").fill("e2e: return to qualification");
  await page.getByRole("button", { name: "Move back" }).click();
  await expect(page.locator('[data-stage="3"]').getByRole("link", { name })).toBeVisible();

  await page.locator('[data-stage="3"]').getByRole("link", { name }).click();
  await page.getByRole("link", { name: "History" }).click();
  const history = page.getByRole("table");
  await expect(history).toContainText("Gate override");
  await expect(history).toContainText("e2e: leadership approved early design work");
  await expect(history).toContainText("e2e: return to qualification");
});

test("opportunity page: award window is locked until Funding and Procurement path are green", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Fleet training readiness dashboard" }).click();
  await expect(page.getByTestId("stage-chip")).toContainText("Stage 5");
  await expect(page.getByTestId("award-locked")).toContainText("Saved value Q2 FY27 is kept");
  await expect(page.getByLabel("Quarter")).toBeDisabled();
  await expect(page.getByTestId("gate-checklist").locator('[data-met="false"]')).toContainText(["Deployment branch A/B/C set"]);
});
