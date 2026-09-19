import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const ROUTES: Record<string, string> = {
  "/": "iam.html",
  "/iam": "iam.html",
  "/iam/success": "iam-success.html",
  "/vpc": "vpc.html",
  "/vpc/endpoint": "vpce.html",
  "/s3": "s3.html",
  "/cli": "cli.html",
  "/cloudwatch": "cloudwatch.html",
};

export async function startMockConsoleServer(
  port = 4177,
): Promise<{ origin: string; close: () => Promise<void> }> {
  const root = path.dirname(fileURLToPath(import.meta.url));

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const mapped = ROUTES[url.pathname] ?? url.pathname.replace(/^\//, "");
    const filePath = path.join(root, mapped);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] ?? "text/plain" });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const isDirect = process.argv[1]?.endsWith("server.ts");
if (isDirect) {
  const port = Number(process.env.PORT ?? 4177);
  startMockConsoleServer(port).then((server) => {
    console.log(`Mock AWS console at ${server.origin}`);
  });
}
