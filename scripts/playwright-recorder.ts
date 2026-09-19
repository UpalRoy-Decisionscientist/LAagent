import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { VisualAsset } from "../shared/types.ts";

export interface StepCaptureConfig {
  stepIndex: number;
  slug: string;
  targetSelector?: string;
  actionBeforeCapture?: (page: Page) => Promise<void>;
  caption: string;
}

export interface RecorderInit {
  authStoragePath?: string;
  baseURL?: string;
}

export class AwsConsoleVisualRecorder {
  private browser!: Browser;
  private context!: BrowserContext;
  private page!: Page;
  private readonly outputDir: string;
  private readonly moduleId: string;

  constructor(moduleId: string) {
    this.moduleId = moduleId;
    this.outputDir = path.join(process.cwd(), "public", "assets", "course", moduleId);
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async initialize(init: RecorderInit = {}): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--font-render-hinting=none", "--disable-lcd-text"],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      baseURL: init.baseURL,
      colorScheme: "dark",
      reducedMotion: "reduce",
      storageState: init.authStoragePath,
    });

    await this.context.addInitScript(() => {
      const style = document.createElement("style");
      style.innerHTML =
        "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }";
      document.documentElement.appendChild(style);
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30_000);
  }

  getPage(): Page {
    if (!this.page) throw new Error("Recorder is not initialized.");
    return this.page;
  }

  private async maskSensitiveData(): Promise<void> {
    await this.page.evaluate(() => {
      const accountIdRegex = /\d{4}-\d{4}-\d{4}|\d{12}/g;
      const keyRegex = /AKIA[0-9A-Z]{16}/g;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) {
        nodes.push(walker.currentNode as Text);
      }
      for (const node of nodes) {
        if (!node.nodeValue) continue;
        node.nodeValue = node.nodeValue
          .replace(accountIdRegex, "1234-5678-9012")
          .replace(keyRegex, "AKIAXXXXXXXXEXAMPLE");
      }
    });
  }

  async recordStep(config: StepCaptureConfig): Promise<VisualAsset> {
    if (!this.page) {
      throw new Error("Recorder is not initialized.");
    }
    if (config.actionBeforeCapture) {
      await config.actionBeforeCapture(this.page);
    }

    await this.page.waitForLoadState("networkidle");
    await this.maskSensitiveData();

    if (config.targetSelector) {
      const handle = await this.page.waitForSelector(config.targetSelector, { state: "visible" });
      await handle.evaluate((element) => {
        element.scrollIntoView({ block: "center", inline: "nearest" });
      });
    }

    const rawPngPath = path.join(
      this.outputDir,
      `step-${config.stepIndex}-${config.slug}-raw.png`,
    );
    const finalWebpPath = path.join(
      this.outputDir,
      `step-${config.stepIndex}-${config.slug}.webp`,
    );

    if (config.targetSelector) {
      const element = this.page.locator(config.targetSelector);
      await element.screenshot({ path: rawPngPath, type: "png" });
    } else {
      await this.page.screenshot({ path: rawPngPath, fullPage: false, type: "png" });
    }

    const converted = await sharp(rawPngPath)
      .webp({ quality: 92, effort: 4 })
      .toFile(finalWebpPath);
    const rawMeta = await sharp(rawPngPath).metadata();
    fs.unlinkSync(rawPngPath);

    if ((converted.size ?? 0) < 8_000) {
      throw new Error(`Screenshot for ${config.slug} is too small to be publication-grade.`);
    }

    return {
      stepIndex: config.stepIndex,
      slug: config.slug,
      webpPath: `/assets/course/${this.moduleId}/step-${config.stepIndex}-${config.slug}.webp`,
      width: converted.width ?? rawMeta.width ?? 1920,
      height: converted.height ?? rawMeta.height ?? 1080,
      bytes: converted.size ?? 0,
      caption: config.caption,
    };
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}

async function runStandalone(): Promise<void> {
  const { startMockConsoleServer } = await import("./mock-console/server.ts");
  const { DEFAULT_CAPTURE_PLAN } = await import("../shared/capture-plan.ts");
  const server = await startMockConsoleServer(4177);
  const recorder = new AwsConsoleVisualRecorder("s3-vpc-private-access");
  await recorder.initialize({ baseURL: server.origin });
  try {
    for (const step of DEFAULT_CAPTURE_PLAN) {
      await recorder.recordStep({
        stepIndex: step.index,
        slug: step.slug,
        targetSelector: step.selector,
        caption: step.caption,
        actionBeforeCapture: async (page) => {
          await page.goto(step.route, { waitUntil: "networkidle" });
        },
      });
    }
  } finally {
    await recorder.close();
    await server.close();
  }
}

const isDirect = process.argv[1]?.endsWith("playwright-recorder.ts");
if (isDirect) {
  runStandalone().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
