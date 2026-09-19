import type { Page } from "playwright";

export const LAB_IAM_USER = "academy-operator";
export const LAB_IAM_PASSWORD = "LabOnly!NeverProduction";
export const LAB_ACCOUNT_ID = "123456789012";

export interface AwsConsoleLoginOptions {
  accountId: string;
  username: string;
  password: string;
}

export function readLiveAwsLoginFromEnv(): AwsConsoleLoginOptions | null {
  const accountId = process.env.AWS_CONSOLE_ACCOUNT_ID?.trim();
  const username = process.env.AWS_CONSOLE_USERNAME?.trim();
  const password = process.env.AWS_CONSOLE_PASSWORD;
  if (!accountId || !username || !password) return null;
  return { accountId, username, password };
}

export async function loginAwsIamUser(page: Page, options: AwsConsoleLoginOptions): Promise<void> {
  await page.locator("#account").fill(options.accountId);
  await page.locator("#username").fill(options.username);
  await page.locator("#password").fill(options.password);
  await page.locator("#signin_button").click();
  await page.waitForURL(/\/console\/home/);
  await page.getByText("signed in", { exact: false }).waitFor({ state: "visible" });
}

export async function captureLiveAwsSignIn(page: Page): Promise<{ url: string; title: string }> {
  await page.goto("https://console.aws.amazon.com/lambda/home?region=us-east-1", {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  });
  await page.waitForTimeout(1500);
  return { url: page.url(), title: await page.title() };
}

export async function loginLiveAwsConsole(page: Page, options: AwsConsoleLoginOptions): Promise<void> {
  const accountHost = `${options.accountId.replace(/-/g, "")}.signin.aws.amazon.com`;
  await page.goto(`https://${accountHost}/console`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const username = page.locator("#username, input[name='username'], input[name='account']").first();
  await username.waitFor({ state: "visible", timeout: 20_000 });
  await username.fill(options.username);
  const password = page.locator("#password, input[name='password'][type='password']").first();
  await password.fill(options.password);
  await page.locator("#signin_button, #signInSubmitButton, button[type='submit']").first().click();
  await page.waitForURL(/console\.aws\.amazon\.com/, { timeout: 45_000 });
}
