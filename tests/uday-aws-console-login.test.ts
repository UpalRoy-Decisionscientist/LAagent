import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runUdayAwsConsoleLoginE2e } from "../scripts/uday-aws-console-login-e2e.ts";

describe("Playwright AWS login · Uday Module 08", () => {
  it("signs in as an IAM user and completes the Lambda lab with screenshots", async () => {
    const report = await runUdayAwsConsoleLoginE2e();
    expect(report.udayLab).toMatch(/enterprise-image-processor/);
    const assets = report.assets as Array<{ slug: string; webpPath: string }>;
    const slugs = assets.map((asset) => asset.slug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "iam-signin-blank",
        "console-home-authenticated",
        "lambda-create-uday-lab",
        "lambda-function-created",
        "lambda-cloudwatch-logs",
      ]),
    );
    for (const asset of assets) {
      const disk = `public${asset.webpPath}`;
      expect(existsSync(disk), disk).toBe(true);
    }
  }, 120_000);
});
