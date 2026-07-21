import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));

async function makeExecutionFixture(request: import("@playwright/test").APIRequestContext) {
  const cycle = await (
    await request.post(`/api/projects/${ctx.projectId}/cycles`, {
      data: { name: `E2E Execution Cycle ${Date.now()}` },
    })
  ).json();
  const testcase = await (
    await request.post(`/api/projects/${ctx.projectId}/testcases`, {
      data: { title: `E2E Execution Test Case ${Date.now()}` },
    })
  ).json();
  await request.post(`/api/cycles/${cycle.id}/testcases`, { data: { testcaseIds: [testcase.id] } });
  const executions = await (await request.get(`/api/cycles/${cycle.id}/executions`)).json();
  return { cycle, testcase, execution: executions[0] };
}

async function cleanupExecutionFixture(
  request: import("@playwright/test").APIRequestContext,
  fixture: { cycle: { id: string }; testcase: { id: string } },
) {
  await request.delete(`/api/cycles/${fixture.cycle.id}`, { failOnStatusCode: false });
  await request.delete(`/api/projects/${ctx.projectId}/testcases/${fixture.testcase.id}`, {
    failOnStatusCode: false,
  });
}

test.describe("test execution updates", () => {
  test("adding a test case to a cycle auto-creates an Untested execution with no executedAt", async ({
    request,
  }) => {
    const fixture = await makeExecutionFixture(request);
    try {
      expect(fixture.execution.status).toBe("Untested");
      expect(fixture.execution.executedAt).toBeFalsy();
      expect(fixture.execution.testcaseId).toBe(fixture.testcase.id);
    } finally {
      await cleanupExecutionFixture(request, fixture);
    }
  });

  test("updating status stamps executedAt; updating an unrelated field without status does not", async ({
    request,
  }) => {
    const fixture = await makeExecutionFixture(request);
    try {
      const passRes = await request.patch(
        `/api/cycles/${fixture.cycle.id}/executions/${fixture.execution.id}`,
        { data: { status: "Passed" } },
      );
      expect(passRes.ok()).toBeTruthy();

      const afterPass = await (await request.get(`/api/cycles/${fixture.cycle.id}/executions`)).json();
      const passedExecution = afterPass[0];
      expect(passedExecution.status).toBe("Passed");
      expect(passedExecution.executedAt).toBeTruthy();
      const stampedAt = passedExecution.executedAt;

      // Sending actualResult with no status must leave the existing executedAt stamp untouched
      // (legacy.service.ts:1822's `CASE WHEN $2 IS NULL THEN executed_at ELSE now() END`).
      await request.patch(`/api/cycles/${fixture.cycle.id}/executions/${fixture.execution.id}`, {
        data: { actualResult: "Observed behavior differs from expected" },
      });

      const afterUnrelatedUpdate = await (
        await request.get(`/api/cycles/${fixture.cycle.id}/executions`)
      ).json();
      const updatedExecution = afterUnrelatedUpdate[0];
      expect(updatedExecution.actualResult).toBe("Observed behavior differs from expected");
      expect(updatedExecution.status).toBe("Passed");
      expect(updatedExecution.executedAt).toBe(stampedAt);
    } finally {
      await cleanupExecutionFixture(request, fixture);
    }
  });

  test("persists assigneeId, defectKey, and defectUrl", async ({ request }) => {
    const fixture = await makeExecutionFixture(request);
    try {
      const meRes = await request.get("/api/auth/me");
      const me = await meRes.json();

      const patchRes = await request.patch(
        `/api/cycles/${fixture.cycle.id}/executions/${fixture.execution.id}`,
        {
          data: {
            status: "Failed",
            assigneeId: me.userId,
            defectKey: "BUG-123",
            defectUrl: "https://example.com/BUG-123",
          },
        },
      );
      expect(patchRes.ok()).toBeTruthy();

      const afterUpdate = await (await request.get(`/api/cycles/${fixture.cycle.id}/executions`)).json();
      const updatedExecution = afterUpdate[0];
      expect(updatedExecution.assigneeId).toBe(me.userId);
      expect(updatedExecution.defectKey).toBe("BUG-123");
      expect(updatedExecution.defectUrl).toBe("https://example.com/BUG-123");
    } finally {
      await cleanupExecutionFixture(request, fixture);
    }
  });

  test("supports every status in the EXEC_STATUSES set the UI offers", async ({ request }) => {
    const fixture = await makeExecutionFixture(request);
    try {
      for (const status of ["Untested", "Passed", "Failed", "Skipped", "Blocked", "Retest"]) {
        const patchRes = await request.patch(
          `/api/cycles/${fixture.cycle.id}/executions/${fixture.execution.id}`,
          { data: { status } },
        );
        expect(patchRes.ok()).toBeTruthy();

        const afterUpdate = await (await request.get(`/api/cycles/${fixture.cycle.id}/executions`)).json();
        expect(afterUpdate[0].status).toBe(status);
      }
    } finally {
      await cleanupExecutionFixture(request, fixture);
    }
  });
});
