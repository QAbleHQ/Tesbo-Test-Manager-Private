import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));

test.describe("bug CRUD", () => {
  test("supports the create -> read -> update -> list -> delete lifecycle", async ({ request }) => {
    const title = `E2E Bug ${Date.now()}`;
    const created = await (
      await request.post(`/api/projects/${ctx.projectId}/bugs`, {
        data: { title, description: "Created by the e2e suite", severity: "High" },
      })
    ).json();

    try {
      expect(created.id).toBeTruthy();
      expect(created.title).toBe(title);
      expect(created.status).toBe("Open");
      expect(created.severity).toBe("High");
      expect(created.links).toEqual([]);
      expect(created.attachments).toEqual([]);

      const getRes = await request.get(`/api/bugs/${created.id}`);
      expect(getRes.ok()).toBeTruthy();
      expect((await getRes.json()).description).toBe("Created by the e2e suite");

      const updatedTitle = `${title} (updated)`;
      const patchRes = await request.patch(`/api/bugs/${created.id}`, {
        data: { title: updatedTitle, status: "In Progress" },
      });
      expect(patchRes.ok()).toBeTruthy();

      const getAfterUpdateRes = await request.get(`/api/bugs/${created.id}`);
      const afterUpdate = await getAfterUpdateRes.json();
      expect(afterUpdate.title).toBe(updatedTitle);
      expect(afterUpdate.status).toBe("In Progress");

      const listRes = await request.get(`/api/projects/${ctx.projectId}/bugs`);
      const list = await listRes.json();
      expect(list.some((b: { id: string }) => b.id === created.id)).toBeTruthy();

      const filteredListRes = await request.get(`/api/projects/${ctx.projectId}/bugs`, {
        params: { status: "In Progress" },
      });
      const filteredList = await filteredListRes.json();
      expect(filteredList.some((b: { id: string }) => b.id === created.id)).toBeTruthy();
    } finally {
      await request.delete(`/api/bugs/${created.id}`, { failOnStatusCode: false });
    }

    const getAfterDeleteRes = await request.get(`/api/bugs/${created.id}`, { failOnStatusCode: false });
    expect(getAfterDeleteRes.status()).toBe(404);
  });

  test("creating a bug with a link populates it, and addBugLink/removeBugLink manage further links", async ({
    request,
  }) => {
    const cycle = await (
      await request.post(`/api/projects/${ctx.projectId}/cycles`, {
        data: { name: `E2E Bug Link Cycle ${Date.now()}` },
      })
    ).json();
    const testcaseA = await (
      await request.post(`/api/projects/${ctx.projectId}/testcases`, {
        data: { title: `E2E Bug Link Case A ${Date.now()}` },
      })
    ).json();
    const testcaseB = await (
      await request.post(`/api/projects/${ctx.projectId}/testcases`, {
        data: { title: `E2E Bug Link Case B ${Date.now()}` },
      })
    ).json();
    await request.post(`/api/cycles/${cycle.id}/testcases`, {
      data: { testcaseIds: [testcaseA.id, testcaseB.id] },
    });

    const created = await (
      await request.post(`/api/projects/${ctx.projectId}/bugs`, {
        data: {
          title: `E2E Bug With Link ${Date.now()}`,
          links: [{ testcaseId: testcaseA.id, cycleId: cycle.id }],
        },
      })
    ).json();

    try {
      expect(created.links).toHaveLength(1);
      expect(created.links[0].testcaseId).toBe(testcaseA.id);

      const afterAddLink = await (
        await request.post(`/api/bugs/${created.id}/links`, {
          data: { testcaseId: testcaseB.id, cycleId: cycle.id },
        })
      ).json();
      expect(afterAddLink.links).toHaveLength(2);

      const linkToRemove = afterAddLink.links.find((l: { testcaseId: string }) => l.testcaseId === testcaseB.id);
      const afterRemoveLink = await (
        await request.delete(`/api/bugs/${created.id}/links/${linkToRemove.id}`)
      ).json();
      expect(afterRemoveLink.links).toHaveLength(1);
      expect(afterRemoveLink.links[0].testcaseId).toBe(testcaseA.id);
    } finally {
      await request.delete(`/api/bugs/${created.id}`, { failOnStatusCode: false });
      await request.delete(`/api/cycles/${cycle.id}`, { failOnStatusCode: false });
      await request.delete(`/api/projects/${ctx.projectId}/testcases/${testcaseA.id}`, {
        failOnStatusCode: false,
      });
      await request.delete(`/api/projects/${ctx.projectId}/testcases/${testcaseB.id}`, {
        failOnStatusCode: false,
      });
    }
  });

  test("sending an empty string to clear a field leaves the old value in place", async ({ request }) => {
    // KNOWN GAP (documented, not test.fail() — a data-integrity bug, not a security one):
    // updateBug (legacy.service.ts:1958) sends every field as `body.field || null`, so an
    // empty string collapses to null before it ever reaches COALESCE, which then keeps the old
    // value. There is currently no way to blank out these fields via this endpoint. Pinned here
    // so this doesn't get silently "fixed" (or silently regress further) without anyone noticing.
    const created = await (
      await request.post(`/api/projects/${ctx.projectId}/bugs`, {
        data: {
          title: `E2E Bug Unclearable ${Date.now()}`,
          description: "Original description",
          externalUrl: "https://example.com/original",
        },
      })
    ).json();

    try {
      await request.patch(`/api/bugs/${created.id}`, {
        data: { description: "", externalUrl: "" },
      });

      const afterClearAttempt = await (await request.get(`/api/bugs/${created.id}`)).json();
      expect(afterClearAttempt.description).toBe("Original description");
      expect(afterClearAttempt.externalUrl).toBe("https://example.com/original");
    } finally {
      await request.delete(`/api/bugs/${created.id}`, { failOnStatusCode: false });
    }
  });
});
