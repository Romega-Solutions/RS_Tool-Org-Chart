import assert from "node:assert/strict";
import test from "node:test";

const modulePath = new URL("../src/lib/n8n-photo-storage.ts", import.meta.url);

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

const env = {
  N8N_URL: "https://n8n.example",
  N8N_API_KEY: "secret",
  N8N_ORG_CHART_PHOTO_TABLE_ID: "photo-table",
};

test("n8n photo storage saves and reads a photo asset", async () => {
  const { getN8nPhoto, saveN8nPhoto } = await import(modulePath);
  const calls = [];

  await withEnv(env, async () => {
    process.env.N8N_ORG_CHART_PHOTO_TABLE_ID = `${process.env.N8N_ORG_CHART_PHOTO_TABLE_ID}\\r\\n`;
    const saved = await saveN8nPhoto(
      {
        filename: "1779000000000-person.webp",
        contentType: "image/webp",
        bytes: Buffer.from("webp-bytes"),
      },
      async (url, init) => {
        calls.push({ url, init });
        return Response.json([
          {
            id: 7,
            filename: "1779000000000-person.webp",
            contentType: "image/webp",
            dataBase64: Buffer.from("webp-bytes").toString("base64"),
            size: "10",
          },
        ]);
      },
    );

    const read = await getN8nPhoto("1779000000000-person.webp", async (url) => {
      calls.push({ url });
      return Response.json([
        {
          id: 7,
          filename: "1779000000000-person.webp",
          contentType: "image/webp",
          dataBase64: Buffer.from("webp-bytes").toString("base64"),
          size: "10",
        },
      ]);
    });

    assert.equal(saved.filename, "1779000000000-person.webp");
    assert.equal(read?.bytes.toString("utf8"), "webp-bytes");
    assert.equal(calls[0].url, "https://n8n.example/api/v1/data-tables/photo-table/rows");
    assert.equal(JSON.parse(calls[0].init.body).data[0].dataBase64, Buffer.from("webp-bytes").toString("base64"));
    assert.equal(
      calls[1].url,
      "https://n8n.example/api/v1/data-tables/photo-table/rows?limit=250&search=1779000000000-person.webp",
    );
  });
});

test("n8n photo storage lists and deletes by encoded query filter", async () => {
  const { deleteN8nPhoto, listN8nPhotos } = await import(modulePath);
  const calls = [];

  await withEnv(env, async () => {
    const photos = await listN8nPhotos(async (url) => {
      calls.push({ url });
      return Response.json({
        data: [
          {
            id: 1,
            filename: "b.webp",
            contentType: "image/webp",
            dataBase64: "Yg==",
            size: "1",
          },
          {
            id: 2,
            filename: "a.webp",
            contentType: "image/webp",
            dataBase64: "YQ==",
            size: "1",
          },
        ],
      });
    });

    await deleteN8nPhoto("a.webp", async (url, init) => {
      calls.push({ url, init });
      return Response.json(true);
    });

    assert.deepEqual(
      photos.map((photo) => photo.filename),
      ["b.webp", "a.webp"],
    );
    assert.equal(calls[0].url, "https://n8n.example/api/v1/data-tables/photo-table/rows?limit=250");
    assert.equal(
      calls[1].url,
      'https://n8n.example/api/v1/data-tables/photo-table/rows/delete?filter=%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22columnName%22%3A%22filename%22%2C%22condition%22%3A%22eq%22%2C%22value%22%3A%22a.webp%22%7D%5D%7D',
    );
    assert.equal(calls[1].init.method, "DELETE");
    assert.equal(calls[1].init.body, undefined);
  });
});
