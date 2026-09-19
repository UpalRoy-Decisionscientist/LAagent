import fs from "node:fs";
import path from "node:path";
import type { CollaborationBasin } from "../shared/basin.ts";
import { DEFAULT_CAPTURE_PLAN } from "../shared/capture-plan.ts";
import type { CaptureStep, VisualAsset } from "../shared/types.ts";
import { AwsConsoleVisualRecorder } from "../scripts/playwright-recorder.ts";

export { DEFAULT_CAPTURE_PLAN };

export async function runPlaywrightAgent(
  basin: CollaborationBasin,
  options: {
    moduleId: string;
    mockServerOrigin: string;
    authStoragePath?: string;
    setPlan?: (plan: CaptureStep[]) => void;
  },
): Promise<void> {
  basin.requireGate("GRAPH_AND_PRUNE");
  assertCaptureLayout();
  const plan = basin.read().capturePlan?.length
    ? basin.read().capturePlan!
    : DEFAULT_CAPTURE_PLAN;
  options.setPlan?.(plan);

  const recorder = new AwsConsoleVisualRecorder(options.moduleId);
  await recorder.initialize({
    authStoragePath: options.authStoragePath,
    baseURL: options.mockServerOrigin,
  });

  try {
    const assets: VisualAsset[] = [];
    for (const step of plan) {
      const captured = await recorder.recordStep({
        stepIndex: step.index,
        slug: step.slug,
        targetSelector: step.selector,
        caption: step.caption,
        actionBeforeCapture: async (page) => {
          await page.goto(step.route, { waitUntil: "networkidle" });
          if (step.highlight) {
            const highlight = page.locator(step.highlight);
            if (await highlight.count()) {
              await highlight.evaluate((el) => {
                el.classList.add("capture-highlight");
              });
            }
          }
        },
      });
      assets.push(captured);
    }
    basin.update((state) => {
      state.capturePlan = plan;
      state.assets = assets;
    });
    basin.post(
      {
        from: "playwright-runner",
        to: "pedagogical-auditor",
        gate: "PLAYWRIGHT_CAPTURE",
        status: "ok",
        summary: `Captured ${assets.length} Retina 2x walkthrough frames.`,
        payload: { count: assets.length, routes: plan.map((step) => step.route) },
      },
      "ok",
    );
  } finally {
    await recorder.close();
  }
}

export function assertCaptureLayout(): void {
  const mockDir = path.join(process.cwd(), "scripts", "mock-console");
  if (!fs.existsSync(path.join(mockDir, "console.css"))) {
    throw new Error("Mock AWS console stylesheet is missing.");
  }
}
