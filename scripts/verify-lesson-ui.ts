import { chromium } from "playwright";

const origin = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173";
const expectedTitle = process.env.EXPECT_TITLE;
const minSteps = Number(process.env.MIN_STEPS ?? "4");
const screenshotPath =
  process.env.UI_PROOF ?? "public/assets/course/s3-vpc-private-access/ui-desktop-proof.png";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(origin, { waitUntil: "networkidle" });

const title = await page.locator("h1").innerText();
if (expectedTitle && title !== expectedTitle) {
  throw new Error(`Unexpected title: ${title}`);
}
if (!title.trim()) {
  throw new Error("Lesson title is empty.");
}

const steps = page.locator('nav[aria-label="Lesson steps"] button');
const count = await steps.count();
if (count < minSteps) {
  throw new Error(`Expected at least ${minSteps} step buttons, found ${count}`);
}

const images: string[] = [];
for (let i = 0; i < count; i += 1) {
  await steps.nth(i).click();
  await page.waitForFunction(
    () => {
      const node = document.querySelector(".lg\\:col-span-7 img") as HTMLImageElement | null;
      return Boolean(node && node.complete && node.naturalWidth > 400);
    },
    { timeout: 10_000 },
  );
  const natural = await page
    .locator(".lg\\:col-span-7 img")
    .first()
    .evaluate((node: HTMLImageElement) => ({
      src: node.currentSrc || node.src,
      w: node.naturalWidth,
      h: node.naturalHeight,
      complete: node.complete,
    }));
  if (!natural.complete || natural.w < 400) {
    throw new Error(`Step ${i + 1} image failed: ${JSON.stringify(natural)}`);
  }
  images.push(natural.src);
}

if (new Set(images).size !== count) {
  throw new Error(`Images did not change per step: ${images.join(", ")}`);
}

await page.getByTitle("Open high-DPI snapshot").click();
await page.getByRole("dialog").waitFor({ state: "visible" });
await page.getByRole("dialog").locator("button").first().click();

const area = page.locator("textarea");
if ((await area.count()) === 0) {
  throw new Error("Skip-gate textarea missing.");
}
await area.fill(
  "IAM STS KMS least privilege role CloudWatch S3 VPC Lambda MFA gateway endpoint aws:SourceVpce no NAT",
);
await page.getByRole("button", { name: "Evaluate skip gate" }).click();
const passText = await page.locator("text=skip the prerequisite").innerText();

await area.fill("public everything");
await page.getByRole("button", { name: "Evaluate skip gate" }).click();
const failText = await page.locator("text=more required signal").innerText();

await page.screenshot({ path: screenshotPath, fullPage: true });

console.log(
  JSON.stringify(
    {
      title,
      stepImages: images.length,
      uniqueImages: new Set(images).size,
      skipPass: passText,
      skipFail: failText,
    },
    null,
    2,
  ),
);

await browser.close();
