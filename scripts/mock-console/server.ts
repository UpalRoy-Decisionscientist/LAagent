import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CaptureStep } from "../../shared/types.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const STATIC_ROUTES: Record<string, string> = {
  "/": "signin.html",
  "/signin": "signin.html",
  "/console/home": "console-home.html",
  "/lambda/create": "lambda-create.html",
  "/lambda/success": "lambda-success.html",
  "/lambda/logs": "lambda-logs.html",
  "/iam": "iam.html",
  "/iam/success": "iam-success.html",
  "/vpc": "vpc.html",
  "/vpc/endpoint": "vpce.html",
  "/s3": "s3.html",
  "/cli": "cli.html",
  "/cloudwatch": "cloudwatch.html",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderDynamicStep(step: CaptureStep): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(step.title)} | AWS Console (lab replica)</title>
    <link rel="stylesheet" href="/console.css" />
  </head>
  <body>
    <div class="shell">
      <aside class="rail">
        <div class="dot active">LAB</div>
        <div class="dot">IAM</div>
        <div class="dot">S3</div>
        <div class="dot">λ</div>
      </aside>
      <section class="main">
        <header class="top">
          <div class="brand">AWS <span>Academy Lab Console</span></div>
          <div class="account">Account 1234-5678-9012 · us-east-1</div>
        </header>
        <div class="content">
          <div class="navcrumbs">Curriculum lab &gt; Step ${step.index}</div>
          <div class="card" data-capture="panel">
            <div class="banner">Instructional replica · identifiers redacted · Uday AWS source</div>
            <h1>${escapeHtml(step.title)}</h1>
            <p class="lead">${escapeHtml(step.description)}</p>
            <div class="grid">
              <div>
                <label>Procedure</label>
                <div class="field" data-highlight="focus">${escapeHtml(step.caption)}</div>
                <label style="margin-top:16px">Well-Architected</label>
                <div class="field">${escapeHtml(step.wellArchitectedPillars.join(" · "))}</div>
              </div>
              <div>
                <label>CLI (no long-lived keys)</label>
                <pre class="terminal">${escapeHtml(step.cliFallback ?? "aws sts get-caller-identity")}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

export async function startMockConsoleServer(
  port = 4177,
): Promise<{
  origin: string;
  close: () => Promise<void>;
  setPlan: (plan: CaptureStep[]) => void;
}> {
  const root = path.dirname(fileURLToPath(import.meta.url));
  let plan: CaptureStep[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname === "/plan.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(plan));
      return;
    }
    const stepMatch = url.pathname.match(/^\/step\/(\d+)$/);
    if (stepMatch) {
      const step = plan.find((item) => item.index === Number(stepMatch[1]));
      if (!step) {
        res.writeHead(404);
        res.end("Unknown step");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderDynamicStep(step));
      return;
    }
    const mapped = STATIC_ROUTES[url.pathname] ?? url.pathname.replace(/^\//, "");
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
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    origin: `http://127.0.0.1:${actualPort}`,
    setPlan: (next) => {
      plan = next;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
