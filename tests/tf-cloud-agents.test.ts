import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveAwsCallerIdentity, runTfCloudAgents } from "../agents/aws-tf-cloud-agents.ts";
import {
  moduleInvocationHcl,
  tfCloudAgentInputsFromEnv,
  validateTfCloudAgentInputs,
} from "../shared/tf-cloud-agents.ts";

describe("aws-ia terraform-aws-tf-cloud-agents", () => {
  it("rejects invalid VPC and subnet identifiers like the upstream module", () => {
    const input = tfCloudAgentInputsFromEnv({
      AWS_VPC_ID: "not-a-vpc",
      AWS_SUBNET_IDS: "subnet-abc,bad",
      TFC_ORG_NAME: "academy",
      TFC_AGENT_NAME: "lab",
    });
    expect(validateTfCloudAgentInputs(input)).toEqual(
      expect.arrayContaining([
        "vpc_id must be a valid VPC ID",
        "subnet_ids must be a list of valid subnet IDs",
      ]),
    );
  });

  it("embeds the registry module invocation and ReadOnlyAccess task role", () => {
    const hcl = moduleInvocationHcl({ name: "laagent-tfc", hcp_terraform_org_name: "academy" });
    expect(hcl).toContain('source  = "aws-ia/tf-cloud-agents/aws"');
    expect(hcl).toContain("ReadOnlyAccess");
  });

  it("resolves STS identity from injected JSON without console passwords", () => {
    const identity = resolveAwsCallerIdentity({
      AWS_CALLER_IDENTITY_JSON: JSON.stringify({
        Account: "111122223333",
        Arn: "arn:aws:iam::111122223333:role/academy-operator",
        UserId: "AIDAIOSFODNN7EXAMPLE",
      }),
    });
    expect(identity.source).toBe("sts");
    expect(identity.account).toBe("111122223333");
  });

  it("dry-runs the agent stack and writes redacted tfvars", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tfc-agents-"));
    const report = runTfCloudAgents({
      terraformDir: dir,
      env: {
        TFC_ORG_NAME: "academy",
        AWS_VPC_ID: "vpc-0abc123def4567890",
        AWS_SUBNET_IDS: "subnet-0aaa111bbb222ccc3,subnet-0ddd444eee555fff6",
        TFC_AGENT_TOKEN: "secret-token",
      },
    });
    expect(report.mode).toBe("dry-run");
    expect(report.source).toContain("terraform-aws-tf-cloud-agents");
    expect(report.inputs.tfe_agent_token).toBe("***");
    const written = JSON.parse(readFileSync(report.tfvarsPath, "utf8")) as {
      tfe_agent_token: string;
      aws_region: string;
    };
    expect(written.tfe_agent_token).toBe("***");
    expect(written.aws_region).toBe("us-west-2");
  });

  it("maps TFE_TOKEN into agent inputs for the HashiCorp provider", () => {
    const input = tfCloudAgentInputsFromEnv({
      TFE_TOKEN: "tfe-secret",
      AWS_VPC_ID: "vpc-0abc123def4567890",
      AWS_SUBNET_IDS: "subnet-0aaa111bbb222ccc3",
      TFC_ORG_NAME: "academy",
    });
    expect(input.tfe_agent_token).toBe("tfe-secret");
  });
});
