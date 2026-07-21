import fs from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, test } from "@playwright/test";
import { env } from "../utils/env";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
const STATE_PATH = path.join(__dirname, "../.auth/state.json");

async function setUpCycleWithOneCase(title: string) {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const cycle = await (
    await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name: `UI Bug Dialog Cycle ${Date.now()}` } })
  ).json();
  // The inline status <select> only renders when the run's own status is "In Progress"
  // (page.tsx: `const isInProgress = run.status === "In Progress"`) — cycles are created in
  // "Planning" by default (migrations/V9_cycle_status.sql), so this must be set explicitly.
  await api.patch(`/api/cycles/${cycle.id}`, { data: { status: "In Progress" } });
  const testcase = await (
    await api.post(`/api/projects/${ctx.projectId}/testcases`, { data: { title } })
  ).json();
  await api.post(`/api/cycles/${cycle.id}/testcases`, { data: { testcaseIds: [testcase.id] } });
  await api.dispose();
  return { cycle, testcase };
}

async function cleanUp(cycleId: string, testcaseId: string) {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  try {
    const bugsRes = await api.get(`/api/projects/${ctx.projectId}/bugs`);
    const bugs = await bugsRes.json();
    for (const bug of bugs) {
      if (bug.links?.some((l: { testcaseId: string }) => l.testcaseId === testcaseId)) {
        await api.delete(`/api/bugs/${bug.id}`);
      }
    }
    await api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
    await api.delete(`/api/projects/${ctx.projectId}/testcases/${testcaseId}`, { failOnStatusCode: false });
  } finally {
    await api.dispose();
  }
}

test.describe("auto bug-filing on Failed", () => {
  test("marking an execution Failed opens the bug dialog, and filing creates a linked bug", async ({
    page,
  }) => {
    const title = `UI Bug Dialog Test Case ${Date.now()}`;
    const { cycle, testcase } = await setUpCycleWithOneCase(title);

    try {
      await page.goto(`/projects/${ctx.projectId}/cycles/${cycle.id}`);
      await page.getByRole("combobox").first().selectOption("Failed");

      await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeVisible();
      const titleInput = page.getByPlaceholder("Brief summary of the bug…");
      await expect(titleInput).toHaveValue(`Failed: ${title}`);

      await page.getByRole("button", { name: "File Bug" }).click();
      await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeHidden();

      const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
      try {
        const bugsRes = await api.get(`/api/projects/${ctx.projectId}/bugs`);
        const bugs = await bugsRes.json();
        const filedBug = bugs.find((b: { title: string }) => b.title === `Failed: ${title}`);
        expect(filedBug).toBeTruthy();
        expect(filedBug.links.some((l: { testcaseId: string; cycleId: string }) =>
          l.testcaseId === testcase.id && l.cycleId === cycle.id,
        )).toBeTruthy();
      } finally {
        await api.dispose();
      }
    } finally {
      await cleanUp(cycle.id, testcase.id);
    }
  });

  test("skipping the dialog leaves the execution Failed with no bug filed", async ({ page }) => {
    const title = `UI Bug Dialog Declined Test Case ${Date.now()}`;
    const { cycle, testcase } = await setUpCycleWithOneCase(title);

    try {
      await page.goto(`/projects/${ctx.projectId}/cycles/${cycle.id}`);
      await page.getByRole("combobox").first().selectOption("Failed");

      await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeVisible();
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeHidden();

      const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
      try {
        const bugsRes = await api.get(`/api/projects/${ctx.projectId}/bugs`);
        const bugs = await bugsRes.json();
        expect(bugs.some((b: { title: string }) => b.title === `Failed: ${title}`)).toBeFalsy();

        const executionsRes = await api.get(`/api/cycles/${cycle.id}/executions`);
        const executions = await executionsRes.json();
        expect(executions[0].status).toBe("Failed");
      } finally {
        await api.dispose();
      }
    } finally {
      await cleanUp(cycle.id, testcase.id);
    }
  });
});
