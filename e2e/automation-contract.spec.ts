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
    expect(schema.inboundEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "org_chart.people.snapshot_requested" }),
      ]),
    );
    expect(schema.outboundEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "org_chart.people.snapshot_ready" }),
        expect.objectContaining({ event: "org_chart.person.updated" }),
      ]),
    );
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
