import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  TF_CLOUD_AGENTS_SOURCE,
  TF_CLOUD_AGENTS_VERSION,
  tfCloudAgentInputsFromEnv,
  toTerraformVars,
  validateTfCloudAgentInputs,
  type TfCloudAgentInputs,
} from "../shared/tf-cloud-agents.ts";

export interface AwsCallerIdentity {
  account: string;
  arn: string;
  userId: string;
  source: "sts" | "env" | "none";
}

export interface TfCloudAgentRun {
  mode: "dry-run" | "plan" | "apply";
  source: string;
  version: string;
  identity: AwsCallerIdentity;
  inputs: TfCloudAgentInputs;
  tfvarsPath: string;
  terraformDir: string;
  validationErrors: string[];
  terraformAvailable: boolean;
  notes: string[];
  outputs?: Record<string, unknown>;
}

const ROOT = path.join(process.cwd(), "terraform", "tf-cloud-agents");

export function detectTerraform(): boolean {
  try {
    execFileSync("terraform", ["version", "-json"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function resolveAwsCallerIdentity(
  env: NodeJS.ProcessEnv = process.env,
): AwsCallerIdentity {
  const injected = env.AWS_CALLER_IDENTITY_JSON?.trim();
  if (injected) {
    const parsed = JSON.parse(injected) as { Account?: string; Arn?: string; UserId?: string };
    return {
      account: parsed.Account ?? "",
      arn: parsed.Arn ?? "",
      userId: parsed.UserId ?? "",
      source: "sts",
    };
  }

  try {
    const raw = execFileSync("aws", ["sts", "get-caller-identity", "--output", "json"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(raw) as { Account: string; Arn: string; UserId: string };
    return { account: parsed.Account, arn: parsed.Arn, userId: parsed.UserId, source: "sts" };
  } catch {
    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
      return {
        account: env.AWS_ACCOUNT_ID ?? "",
        arn: `arn:aws:iam::${env.AWS_ACCOUNT_ID ?? "unknown"}:user/env-credentials`,
        userId: "env",
        source: "env",
      };
    }
    if (env.AWS_PROFILE) {
      return {
        account: env.AWS_ACCOUNT_ID ?? "",
        arn: `arn:aws:iam::profile/${env.AWS_PROFILE}`,
        userId: env.AWS_PROFILE,
        source: "env",
      };
    }
    return { account: "", arn: "", userId: "", source: "none" };
  }
}

export function writeTerraformVars(input: TfCloudAgentInputs, terraformDir = ROOT): string {
  fs.mkdirSync(terraformDir, { recursive: true });
  const tfvarsPath = path.join(terraformDir, "terraform.tfvars.json");
  const vars = toTerraformVars(input);
  const redacted = {
    ...vars,
    tfe_agent_token: input.tfe_agent_token ? "***" : "",
  };
  fs.writeFileSync(tfvarsPath, `${JSON.stringify(redacted, null, 2)}\n`);
  const secretPath = path.join(terraformDir, "generated.auto.tfvars.json");
  fs.writeFileSync(secretPath, `${JSON.stringify(vars, null, 2)}\n`);
  return tfvarsPath;
}

export function runTfCloudAgents(options: {
  env?: NodeJS.ProcessEnv;
  apply?: boolean;
  terraformDir?: string;
} = {}): TfCloudAgentRun {
  const env = options.env ?? process.env;
  const terraformDir = options.terraformDir ?? ROOT;
  const inputs = tfCloudAgentInputsFromEnv(env);
  const validationErrors = validateTfCloudAgentInputs(inputs);
  const identity = resolveAwsCallerIdentity(env);
  const terraformAvailable = detectTerraform();
  const applyRequested = options.apply ?? env.AWS_TF_AGENTS_APPLY === "1";
  const notes: string[] = [
    `Embedded ${TF_CLOUD_AGENTS_SOURCE} ${TF_CLOUD_AGENTS_VERSION} (Apache-2.0).`,
    "AWS access uses the default credential chain / ECS task role — not console passwords.",
  ];

  const placeholderNetwork =
    inputs.vpc_id.includes("00000000000000000") ||
    inputs.subnet_ids.some((id) => id.includes("00000000000000000"));

  if (identity.source === "none") {
    notes.push("No AWS credentials detected. Dry-run only; set AWS_PROFILE or an instance/task role.");
  }
  if (placeholderNetwork) {
    notes.push("Placeholder VPC/subnet IDs in use. Set AWS_VPC_ID and AWS_SUBNET_IDS for a live apply.");
  }
  if (!env.TFC_TOKEN && inputs.create_tfe_agent_pool) {
    notes.push("HCP Terraform API token (TFC_TOKEN) is unset; agent-pool resources cannot be created until it is provided.");
  }

  const tfvarsPath = writeTerraformVars(inputs, terraformDir);
  const canMutate =
    applyRequested &&
    terraformAvailable &&
    identity.source !== "none" &&
    !placeholderNetwork &&
    validationErrors.length === 0;

  let mode: TfCloudAgentRun["mode"] = "dry-run";
  let outputs: Record<string, unknown> | undefined;

  if (canMutate) {
    const args = applyRequested && env.AWS_TF_AGENTS_APPLY === "1" ? (["apply", "-auto-approve"] as const) : (["plan"] as const);
    try {
      execFileSync("terraform", ["init", "-input=false", "-no-color"], {
        cwd: terraformDir,
        stdio: "inherit",
        env,
      });
      execFileSync("terraform", [...args, "-input=false", "-no-color"], {
        cwd: terraformDir,
        stdio: "inherit",
        env,
      });
      mode = args[0] === "apply" ? "apply" : "plan";
      if (mode === "apply") {
        const raw = execFileSync("terraform", ["output", "-json"], {
          cwd: terraformDir,
          encoding: "utf8",
          env,
        });
        outputs = JSON.parse(raw) as Record<string, unknown>;
      }
    } catch (error) {
      notes.push(`Terraform ${args[0]} failed: ${(error as Error).message}`);
      throw error;
    }
  } else if (applyRequested) {
    notes.push("Apply requested but skipped: need AWS identity, real VPC/subnets, passing validation, and terraform CLI.");
  }

  return {
    mode,
    source: TF_CLOUD_AGENTS_SOURCE,
    version: TF_CLOUD_AGENTS_VERSION,
    identity,
    inputs: { ...inputs, tfe_agent_token: inputs.tfe_agent_token ? "***" : "" },
    tfvarsPath,
    terraformDir,
    validationErrors,
    terraformAvailable,
    notes,
    outputs,
  };
}
