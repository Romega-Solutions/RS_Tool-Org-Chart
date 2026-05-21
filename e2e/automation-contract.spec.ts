import { expect, test } from "@playwright/test";
import { appPath } from "./helpers/paths";

const apiHeaders = { "X-API-Key": "playwright-orgchart-api-key" };
const profileFields = [
  "id",
  "name",
  "title",
  "email",
  "departmentId",
  "departmentName",
  "managerId",
  "isActive",
];

test.describe("automation contract", () => {
  test("GET /api/automation/schema exposes the org chart automation schema", async ({ request }) => {
    const response = await request.get(appPath("/api/automation/schema"), { headers: apiHeaders });

    expect(response.status()).toBe(200);
    const schema = await response.json();

    expect(schema.service).toBe("org-chart");
    expect(schema.sourceTool).toBe("RS_Tool-Auto-Org_Chart-Generator");
    expect(schema.auth.header).toBe("X-API-Key");
    expect(schema.staffDirectory.endpoint).toBe("/api/people/headless?includeInactive=false");
    expect(schema.inboundEvents).toContain("org_chart.people.snapshot_requested");
    expect(schema.outboundEvents).toContain("org_chart.people.snapshot_ready");
    expect(schema.outboundEvents).toContain("org_chart.person.updated");
    expect(schema.exampleEnvelope).toEqual(
      expect.objectContaining({
        event: "org_chart.people.snapshot_ready",
        sourceTool: "RS_Tool-Auto-Org_Chart-Generator",
        version: "1.0",
        requestId: "org_20260521_example",
        occurredAt: "2026-05-21T00:00:00.000Z",
        actor: { type: "api", name: "API Integration" },
        data: { people: expect.any(Array) },
      }),
    );
    expect(schema.exampleEnvelope).not.toHaveProperty("id");
    expect(schema.exampleEnvelope).not.toHaveProperty("source");
  });

  test("GET /api/people/headless returns staff profiles with contract metadata", async ({ request }) => {
    const response = await request.get(appPath("/api/people/headless?includeInactive=false"), { headers: apiHeaders });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      people: expect.any(Array),
      contract: {
        version: "1.0",
        profileFields,
      },
    });

    expect(body.people.length).toBeGreaterThan(0);
    const firstPerson = body.people[0];
    expect(firstPerson).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        title: expect.any(String),
        departmentId: expect.any(Number),
        isActive: true,
      }),
    );
    expect(firstPerson).toHaveProperty("departmentName");
    expect(firstPerson).toHaveProperty("managerId");
  });
});
