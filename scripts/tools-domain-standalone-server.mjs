import http from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const publicPort = Number(process.env.PORT ?? 3000);
const internalPort = Number(process.env.NEXT_INTERNAL_PORT ?? publicPort + 1);
const internalHost = "127.0.0.1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";
const healthPath = `${basePath.replace(/\/$/, "")}/api/health`;
const toolsHtmlPath = path.join(process.cwd(), ".next", "server", "app", "tools.html");

const nextServer = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(internalPort),
    HOSTNAME: internalHost,
  },
  stdio: "inherit",
});

function serveToolsHome(clientReq, clientRes) {
  try {
    const { size } = statSync(toolsHtmlPath);
    clientRes.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": size,
    });

    if (clientReq.method === "HEAD") {
      clientRes.end();
      return;
    }

    createReadStream(toolsHtmlPath).pipe(clientRes);
  } catch (error) {
    clientRes.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    clientRes.end(`Tools home is unavailable: ${error.message}`);
  }
}

function proxyRequest(clientReq, clientRes) {
  const requestUrl = new URL(clientReq.url ?? "/", `http://${clientReq.headers.host ?? "localhost"}`);

  if ((clientReq.method === "GET" || clientReq.method === "HEAD") && requestUrl.pathname === "/") {
    serveToolsHome(clientReq, clientRes);
    return;
  }

  const targetPath = `${requestUrl.pathname}${requestUrl.search}`;

  const headers = { ...clientReq.headers, host: clientReq.headers.host ?? `localhost:${publicPort}` };
  delete headers.connection;

  const upstreamReq = http.request(
    {
      hostname: internalHost,
      port: internalPort,
      path: targetPath,
      method: clientReq.method,
      headers,
    },
    (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.statusMessage, upstreamRes.headers);
      if (clientReq.method === "HEAD") {
        upstreamRes.resume();
        clientRes.end();
        return;
      }
      upstreamRes.pipe(clientRes);
    },
  );

  upstreamReq.on("error", (error) => {
    clientRes.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    clientRes.end(`Upstream Next.js server unavailable: ${error.message}`);
  });

  clientReq.pipe(upstreamReq);
}

const server = http.createServer(proxyRequest);

async function waitForUpstream() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const ready = await new Promise((resolve) => {
      const req = http.request({ hostname: internalHost, port: internalPort, path: healthPath, method: "GET" }, (res) => {
        res.resume();
        resolve(Boolean(res.statusCode && res.statusCode < 500));
      });
      req.on("error", () => resolve(false));
      req.setTimeout(1_000, () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });

    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next.js server did not become ready on ${internalHost}:${internalPort}`);
}

waitForUpstream()
  .then(() => {
    server.listen(publicPort, "0.0.0.0", () => {
      console.log(`Tools domain wrapper listening on :${publicPort}, proxying Next.js on ${internalHost}:${internalPort}`);
    });
  })
  .catch((error) => {
    console.error(error);
    nextServer.kill("SIGTERM");
    process.exit(1);
  });

function shutdown(signal) {
  server.close(() => {
    nextServer.kill(signal);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

nextServer.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
