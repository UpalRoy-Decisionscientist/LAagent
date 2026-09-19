import fs from "node:fs";
import path from "node:path";
import {
  captureLiveAwsSignIn,
  LAB_ACCOUNT_ID,
  LAB_IAM_PASSWORD,
  LAB_IAM_USER,
  loginAwsIamUser,
  loginLiveAwsConsole,
  readLiveAwsLoginFromEnv,
} from "../agents/aws-console-login.ts";
import { AwsConsoleVisualRecorder } from "./playwright-recorder.ts";
import { startMockConsoleServer } from "./mock-console/server.ts";

const MODULE_ID = "uday-lambda-console-login";
const PORT = Number(process.env.CONSOLE_E2E_PORT ?? "4181");

export async function runUdayAwsConsoleLoginE2e(): Promise<Record<string, unknown>> {
  const server = await startMockConsoleServer(PORT);
  const recorder = new AwsConsoleVisualRecorder(MODULE_ID);
  await recorder.initialize({ baseURL: server.origin });
  const page = recorder.getPage();
  const assets: Array<{ slug: string; webpPath: string }> = [];
  const notes: string[] = [];

  try {
    try {
      const live = await captureLiveAwsSignIn(page);
      notes.push(`Reached live AWS sign-in (${live.title} at ${live.url}).`);
      assets.push(
        await recorder.recordStep({
          stepIndex: 1,
          slug: "live-aws-signin",
          caption: "Live AWS Sign-In endpoint reachable from Playwright.",
        }),
      );
    } catch (error) {
      notes.push(`Live AWS sign-in capture skipped: ${(error as Error).message}`);
    }

    await page.goto("/signin", { waitUntil: "networkidle" });
    assets.push(
      await recorder.recordStep({
        stepIndex: 2,
        slug: "iam-signin-blank",
        targetSelector: "[data-capture='signin']",
        caption: "IAM user sign-in form before credentials are entered.",
      }),
    );

    await loginAwsIamUser(page, {
      accountId: LAB_ACCOUNT_ID,
      username: LAB_IAM_USER,
      password: LAB_IAM_PASSWORD,
    });
    assets.push(
      await recorder.recordStep({
        stepIndex: 3,
        slug: "console-home-authenticated",
        targetSelector: "[data-capture='home']",
        caption: "Authenticated AWS Console home after IAM user login.",
      }),
    );

    await page.goto("/lambda/create", { waitUntil: "networkidle" });
    assets.push(
      await recorder.recordStep({
        stepIndex: 4,
        slug: "lambda-create-uday-lab",
        targetSelector: "[data-capture='lambda-create']",
        caption: "Uday Module 08 Lab 1: create enterprise-image-processor before submit.",
        actionBeforeCapture: async (current) => {
          await current.locator("[data-highlight='runtime']").evaluate((el) => {
            el.classList.add("capture-highlight");
          });
        },
      }),
    );

    await page.locator("#create-function").click();
    await page.waitForURL(/\/lambda\/success/);
    assets.push(
      await recorder.recordStep({
        stepIndex: 5,
        slug: "lambda-function-created",
        targetSelector: "[data-capture='lambda-success']",
        caption: "Lambda function created with redacted ARN.",
      }),
    );

    await page.goto("/lambda/logs", { waitUntil: "networkidle" });
    assets.push(
      await recorder.recordStep({
        stepIndex: 6,
        slug: "lambda-cloudwatch-logs",
        targetSelector: "[data-capture='lambda-logs']",
        caption: "CloudWatch logs verifying INIT/INVOKE without secrets.",
      }),
    );

    const liveCreds = readLiveAwsLoginFromEnv();
    if (liveCreds && process.env.AWS_E2E_LIVE === "1") {
      await loginLiveAwsConsole(page, liveCreds);
      assets.push(
        await recorder.recordStep({
          stepIndex: 7,
          slug: "live-console-authenticated",
          caption: "Operator-owned live AWS Console session after IAM login.",
        }),
      );
      notes.push("Completed live AWS Console login with operator environment credentials.");
    } else {
      notes.push(
        "Live AWS Console login not executed: set AWS_CONSOLE_ACCOUNT_ID, AWS_CONSOLE_USERNAME, AWS_CONSOLE_PASSWORD, and AWS_E2E_LIVE=1 for an operator-owned account.",
      );
    }

    const report = {
      moduleId: MODULE_ID,
      udayLab: "Module 08 Lab 1 — enterprise-image-processor",
      login: { identity: "IAM user", rootDisabled: true, user: LAB_IAM_USER },
      notes,
      assets,
    };
    const reportDir = path.join(process.cwd(), "content", "reports");
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, "uday-aws-console-login-e2e.json"), JSON.stringify(report, null, 2));
    return report;
  } finally {
    await recorder.close();
    await server.close();
  }
}

const isDirect = process.argv[1]?.endsWith("uday-aws-console-login-e2e.ts");
if (isDirect) {
  runUdayAwsConsoleLoginE2e()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
