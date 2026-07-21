import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));

test.describe("test plan CRUD", () => {
  test("supports the create -> read -> update -> list -> delete lifecycle", async ({ request }) => {
    const name = `E2E Plan ${Date.now()}`;
    const created = await (
      await request.post(`/api/projects/${ctx.projectId}/plans`, {
        data: { name, description: "Created by the e2e suite", targetRelease: "v1.0" },
      })
    ).json();

    try {
      expect(created.id).toBeTruthy();
      expect(created.name).toBe(name);
      expect(created.targetRelease).toBe("v1.0");

      const getRes = await request.get(`/api/plans/${created.id}`);
      expect(getRes.ok()).toBeTruthy();
      expect((await getRes.json()).description).toBe("Created by the e2e suite");

      const updatedName = `${name} (updated)`;
      const patchRes = await request.patch(`/api/plans/${created.id}`, {
        data: { name: updatedName, targetRelease: "v2.0" },
      });
      expect(patchRes.ok()).toBeTruthy();

      const getAfterUpdateRes = await request.get(`/api/plans/${created.id}`);
      const afterUpdate = await getAfterUpdateRes.json();
      expect(afterUpdate.name).toBe(updatedName);
      expect(afterUpdate.targetRelease).toBe("v2.0");

      const listRes = await request.get(`/api/projects/${ctx.projectId}/plans`);
      const list = await listRes.json();
      expect(list.some((p: { id: string }) => p.id === created.id)).toBeTruthy();
    } finally {
      await request.delete(`/api/plans/${created.id}`, { failOnStatusCode: false });
    }

    const getAfterDeleteRes = await request.get(`/api/plans/${created.id}`, { failOnStatusCode: false });
    expect(getAfterDeleteRes.status()).toBe(404);
  });

  test("supports adding and removing plan items (a direct test case and a whole suite)", async ({
    request,
  }) => {
    const plan = await (
      await request.post(`/api/projects/${ctx.projectId}/plans`, {
        data: { name: `E2E Plan Items ${Date.now()}` },
      })
    ).json();
    const suite = await (
      await request.post(`/api/projects/${ctx.projectId}/suites`, {
        data: { name: `E2E Plan Items Suite ${Date.now()}` },
      })
    ).json();
    const testcase = await (
      await request.post(`/api/projects/${ctx.projectId}/testcases`, {
        data: { title: `E2E Plan Items Test Case ${Date.now()}` },
      })
    ).json();

    try {
      const caseItem = await (
        await request.post(`/api/plans/${plan.id}/items`, { data: { testcaseId: testcase.id } })
      ).json();
      const suiteItem = await (
        await request.post(`/api/plans/${plan.id}/items`, { data: { suiteId: suite.id } })
      ).json();

      const itemsRes = await request.get(`/api/plans/${plan.id}/items`);
      const items = await itemsRes.json();
      expect(items.some((i: { id: string }) => i.id === caseItem.id)).toBeTruthy();
      expect(items.some((i: { id: string }) => i.id === suiteItem.id)).toBeTruthy();

      await request.delete(`/api/plans/${plan.id}/items/${caseItem.id}`);

      const itemsAfterRes = await request.get(`/api/plans/${plan.id}/items`);
      const itemsAfter = await itemsAfterRes.json();
      expect(itemsAfter.some((i: { id: string }) => i.id === caseItem.id)).toBeFalsy();
      expect(itemsAfter.some((i: { id: string }) => i.id === suiteItem.id)).toBeTruthy();
    } finally {
      await request.delete(`/api/plans/${plan.id}`, { failOnStatusCode: false });
      await request.delete(`/api/suites/${suite.id}`, { failOnStatusCode: false });
      await request.delete(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`, {
        failOnStatusCode: false,
      });
    }
  });

  test("planRuns/planProgress aggregate executions from cycles linked to the plan", async ({ request }) => {
    const plan = await (
      await request.post(`/api/projects/${ctx.projectId}/plans`, {
        data: { name: `E2E Plan Progress ${Date.now()}` },
      })
    ).json();
    const testcase = await (
      await request.post(`/api/projects/${ctx.projectId}/testcases`, {
        data: { title: `E2E Plan Progress Test Case ${Date.now()}` },
      })
    ).json();
    const cycle = await (
      await request.post(`/api/projects/${ctx.projectId}/cycles`, {
        data: { name: `E2E Plan Progress Cycle ${Date.now()}`, planId: plan.id },
      })
    ).json();

    try {
      await request.post(`/api/cycles/${cycle.id}/testcases`, { data: { testcaseIds: [testcase.id] } });
      const executions = await (await request.get(`/api/cycles/${cycle.id}/executions`)).json();
      await request.patch(`/api/cycles/${cycle.id}/executions/${executions[0].id}`, {
        data: { status: "Passed" },
      });

      const runsRes = await request.get(`/api/plans/${plan.id}/runs`);
      const runs = await runsRes.json();
      expect(runs.some((r: { id: string }) => r.id === cycle.id)).toBeTruthy();

      const progressRes = await request.get(`/api/plans/${plan.id}/progress`);
      const progress = await progressRes.json();
      expect(progress.runCount).toBe(1);
      expect(progress.totalCases).toBe(1);
      expect(progress.passed).toBe(1);
      expect(progress.completionPercent).toBe(100);
    } finally {
      await request.delete(`/api/cycles/${cycle.id}`, { failOnStatusCode: false });
      await request.delete(`/api/plans/${plan.id}`, { failOnStatusCode: false });
      await request.delete(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`, {
        failOnStatusCode: false,
      });
    }
  });
});
