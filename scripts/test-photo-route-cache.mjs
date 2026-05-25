import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("managed photo route does not mark deletable photos immutable", async () => {
  const route = await readFile(new URL("../src/app/uploads/photos/[filename]/route.ts", import.meta.url), "utf8");

  assert.match(route, /Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /immutable/);
});
