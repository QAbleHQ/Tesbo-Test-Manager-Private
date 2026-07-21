import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));

test.describe("test cycle / run CRUD", () => {
  test("supports the create -> read -> update -> list -> delete lifecycle", async ({ request }) => {
    const name = `E2E Cycle ${Date.now()}`;
    const created = await (
      await request.post(`/api/projects/${ctx.projectId}/cycles`, {
        data: { name, description: "Created by the e2e suite", environment: "staging", buildVersion: "1.2.3" },
      })
    ).json();

    try {
      expect(created.id).toBeTruthy();
      expect(created.status).toBe("Planning");
      expect(created.environment).toBe("staging");

      const getRes = await request.get(`/api/cycles/${created.id}`);
      expect(getRes.ok()).toBeTruthy();
      expect((await getRes.json()).buildVersion).toBe("1.2.3");

      const updatedName = `${name} (updated)`;
      const patchRes = await request.patch(`/api/cycles/${created.id}`, {
        data: { name: updatedName, status: "In Progress" },
      });
      expect(patchRes.ok()).toBeTruthy();

      const getAfterUpdateRes = await request.get(`/api/cycles/${created.id}`);
      const afterUpdate = await getAfterUpdateRes.json();
      expect(afterUpdate.name).toBe(updatedName);
      expect(afterUpdate.status).toBe("In Progress");

      const listRes = await request.get(`/api/projects/${ctx.projectId}/cycles`);
      const list = await listRes.json();
      expect(list.some((c: { id: string }) => c.id === created.id)).toBeTruthy();
    } finally {
      await request.delete(`/api/cycles/${created.id}`, { failOnStatusCode: false });
    }

    const getAfterDeleteRes = await request.get(`/api/cycles/${created.id}`, { failOnStatusCode: false });
    expect(getAfterDeleteRes.status()).toBe(404);
  });

  test("updateCycle's planId/clearPlan semantics: an omitted planId keeps it, clearPlan:true nulls it", async ({
    request,
  }) => {
    const plan = await (
      await request.post(`/api/projects/${ctx.projectId}/plans`, {
        data: { name: `E2E Cycle Plan Link ${Date.now()}` },
      })
    ).json();
    const cycle = await (
      await request.post(`/api/projects/${ctx.projectId}/cycles`, {
        data: { name: `E2E Cycle Plan Link Cycle ${Date.now()}`, planId: plan.id },
      })
    ).json();

    try {
      expect(cycle.planId).toBe(plan.id);

      // Updating an unrelated field without sending planId must leave it untouched (unlike
      // updateSuite's parentId, this one IS COALESCE-guarded — legacy.service.ts:1855).
      await request.patch(`/api/cycles/${cycle.id}`, { data: { description: "unrelated update" } });
      const afterUnrelatedUpdate = await (await request.get(`/api/cycles/${cycle.id}`)).json();
      expect(afterUnrelatedUpdate.planId).toBe(plan.id);

      await request.patch(`/api/cycles/${cycle.id}`, { data: { clearPlan: true } });
      const afterClear = await (await request.get(`/api/cycles/${cycle.id}`)).json();
      expect(afterClear.planId).toBeNull();
    } finally {
      await request.delete(`/api/cycles/${cycle.id}`, { failOnStatusCode: false });
      await request.delete(`/api/plans/${plan.id}`, { failOnStatusCode: false });
    }
  });

  test("supports adding and removing test cases, auto-creating one execution per added case", async ({
    request,
  }) => {
    const cycle = await (
      await request.post(`/api/projects/${ctx.projectId}/cycles`, {
        data: { name: `E2E Cycle Cases ${Date.now()}` },
      })
    ).json();
    const testcaseA = await (
      await request.post(`/api/projects/${ctx.projectId}/testcases`, {
        data: { title: `E2E Cycle Case A ${Date.now()}` },
      })
    ).json();
    const testcaseB = await (
      await request.post(`/api/projects/${ctx.projectId}/testcases`, {
        data: { title: `E2E Cycle Case B ${Date.now()}` },
      })
    ).json();

    try {
      await request.post(`/api/cycles/${cycle.id}/testcases`, {
        data: { testcaseIds: [testcaseA.id, testcaseB.id] },
      });

      const executionsRes = await request.get(`/api/cycles/${cycle.id}/executions`);
      const executions = await executionsRes.json();
      expect(executions).toHaveLength(2);
      expect(executions.every((e: { status: string }) => e.status === "Untested")).toBeTruthy();

      await request.delete(`/api/cycles/${cycle.id}/testcases/${testcaseA.id}`);

      const executionsAfterRes = await request.get(`/api/cycles/${cycle.id}/executions`);
      const executionsAfter = await executionsAfterRes.json();
      expect(executionsAfter).toHaveLength(1);
      expect(executionsAfter[0].testcaseId).toBe(testcaseB.id);
    } finally {
      await request.delete(`/api/cycles/${cycle.id}`, { failOnStatusCode: false });
      await request.delete(`/api/projects/${ctx.projectId}/testcases/${testcaseA.id}`, {
        failOnStatusCode: false,
      });
      await request.delete(`/api/projects/${ctx.projectId}/testcases/${testcaseB.id}`, {
        failOnStatusCode: false,
      });
    }
  });

  test("from-plan and from-cases creation are aliases for plain create — neither seeds cycle_items", async ({
    request,
  }) => {
    // KNOWN GAP (documented, not test.fail() — a functional no-op, not a security issue):
    // legacy.controller.ts:363-370 routes createCycleFromPlan/createCycleFromCases to the exact
    // same legacy.createCycle(projectId, body) as the plain endpoint. Despite the names, neither
    // actually copies items from the plan or the given case IDs into cycle_items — pinned here so
    // a future "fix" is a deliberate, visible change rather than an accidental behavior shift.
    const plan = await (
      await request.post(`/api/projects/${ctx.projectId}/plans`, {
        data: { name: `E2E From-Plan Source ${Date.now()}` },
      })
    ).json();
    const testcase = await (
      await request.post(`/api/projects/${ctx.projectId}/testcases`, {
        data: { title: `E2E From-Cases Source ${Date.now()}` },
      })
    ).json();
    await request.post(`/api/plans/${plan.id}/items`, { data: { testcaseId: testcase.id } });

    const fromPlanCycle = await (
      await request.post(`/api/projects/${ctx.projectId}/cycles/from-plan`, {
        data: { name: `E2E From-Plan Cycle ${Date.now()}`, planId: plan.id },
      })
    ).json();
    const fromCasesCycle = await (
      await request.post(`/api/projects/${ctx.projectId}/cycles/from-cases`, {
        data: { name: `E2E From-Cases Cycle ${Date.now()}`, testcaseIds: [testcase.id] },
      })
    ).json();

    try {
      const fromPlanExecutions = await (
        await request.get(`/api/cycles/${fromPlanCycle.id}/executions`)
      ).json();
      const fromCasesExecutions = await (
        await request.get(`/api/cycles/${fromCasesCycle.id}/executions`)
      ).json();
      expect(fromPlanExecutions).toHaveLength(0);
      expect(fromCasesExecutions).toHaveLength(0);
    } finally {
      await request.delete(`/api/cycles/${fromPlanCycle.id}`, { failOnStatusCode: false });
      await request.delete(`/api/cycles/${fromCasesCycle.id}`, { failOnStatusCode: false });
      await request.delete(`/api/plans/${plan.id}`, { failOnStatusCode: false });
      await request.delete(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`, {
        failOnStatusCode: false,
      });
    }
  });
});
