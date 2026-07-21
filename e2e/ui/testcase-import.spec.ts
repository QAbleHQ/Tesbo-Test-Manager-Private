import fs from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, test } from "@playwright/test";
import { env } from "../utils/env";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
const STATE_PATH = path.join(__dirname, "../.auth/state.json");

test.describe("test case import", () => {
  test("importing a CSV shows a completion toast that survives closing the import modal", async ({ page }) => {
    // Regression test for: import completed successfully but no toast notification was
    // ever shown, during or after — see ImportTestCasesModal.tsx / testcases/page.tsx.
    const stamp = Date.now();
    const titleA = `E2E Import ${stamp} A`;
    const titleB = `E2E Import ${stamp} B`;
    const csv = `Title,Description\n${titleA},First imported row\n${titleB},Second imported row\n`;

    await page.goto(`/projects/${ctx.projectId}/testcases`);
    await page.getByRole("button", { name: "Import", exact: true }).click();

    // Upload step: "Browse Files" just opens the OS picker, so set the file directly on
    // the underlying (hidden) input instead of clicking through a native file dialog.
    await page.locator('input[type="file"]').setInputFiles({
      name: "import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Next" }).click();

    // Mapping step: "Title" auto-maps from the CSV header, so the import can proceed as-is.
    await expect(page.getByText("Map your file columns to test case fields.")).toBeVisible();
    await page.getByRole("button", { name: "Import 2 rows" }).click();

    // Result step: the wizard's own in-modal summary confirms the import ran.
    await expect(page.getByText("Import complete.")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Done" }).click();

    // The modal is now closed — a completion toast must still be visible on the page.
    await expect(page.getByText("2 test cases imported successfully")).toBeVisible();

    // The imported rows actually landed, not just the toast text.
    await expect(page.getByRole("button", { name: titleA })).toBeVisible();
    await expect(page.getByRole("button", { name: titleB })).toBeVisible();

    // Clean up via the API so repeat runs don't accumulate test cases in the smoke project.
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    try {
      for (const title of [titleA, titleB]) {
        const listRes = await api.get(`/api/projects/${ctx.projectId}/testcases`, {
          params: { search: title },
        });
        const list = await listRes.json();
        const match = list.find((tc: { id: string; title: string }) => tc.title === title);
        if (match) await api.delete(`/api/projects/${ctx.projectId}/testcases/${match.id}`);
      }
    } finally {
      await api.dispose();
    }
  });
});
