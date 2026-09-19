/**
 * TypeScript surface of aws-ia/terraform-aws-tf-cloud-agents (Apache-2.0).
 * Mirrors variables.tf validations and defaults so the curriculum pipeline can
 * prepare an ECS Fargate HCP Terraform agent without console passwords.
 * Upstream: https://github.com/aws-ia/terraform-aws-tf-cloud-agents
 */

export const TF_CLOUD_AGENTS_SOURCE =
  "https://github.com/aws-ia/terraform-aws-tf-cloud-agents";
export const TF_CLOUD_AGENTS_VERSION = "0.0.2";
export const TF_CLOUD_AGENTS_REGISTRY = "aws-ia/tf-cloud-agents/aws";

export const CLOUDWATCH_RETENTION_DAYS = [
  0, 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653,
] as const;

export const AGENT_LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;
export const AGENT_AUTO_UPDATE = ["minor", "patch", "disabled"] as const;

export type AgentLogLevel = (typeof AGENT_LOG_LEVELS)[number];
export type AgentAutoUpdate = (typeof AGENT_AUTO_UPDATE)[number];

export interface ExtraEnvVar {
  name: string;
  value: string;
}

export interface TfCloudAgentInputs {
  name: string;
  hcp_terraform_org_name: string;
  vpc_id: string;
  subnet_ids: string[];
  aws_region: string;
  hcp_terraform_address: string;
  create_tfe_agent_pool: boolean;
  tfe_agent_token: string;
  tfe_agent_pool_name: string;
  agent_cpu: number;
  agent_memory: number;
  agent_log_level: AgentLogLevel;
  agent_image: string;
  agent_single_execution: boolean;
  agent_auto_update: AgentAutoUpdate;
  agent_egress_ports: string[];
  agent_cidr_blocks: string[];
  extra_env_vars: ExtraEnvVar[];
  num_agents: number;
  create_cloudwatch_log_group: boolean;
  cloudwatch_log_group_retention: number;
  cloudwatch_log_group_name: string;
  create_ecs_cluster: boolean;
  ecs_cluster_arn: string;
  use_spot_instances: boolean;
  task_policy_arns: string[];
  kms_key_arn: string;
  assign_public_ip: boolean;
  tags: Record<string, string>;
}

export const TF_CLOUD_AGENT_DEFAULTS: Omit<
  TfCloudAgentInputs,
  "name" | "hcp_terraform_org_name" | "vpc_id" | "subnet_ids"
> = {
  aws_region: "us-west-2",
  hcp_terraform_address: "https://app.terraform.io",
  create_tfe_agent_pool: true,
  tfe_agent_token: "",
  tfe_agent_pool_name: "",
  agent_cpu: 256,
  agent_memory: 512,
  agent_log_level: "info",
  agent_image: "hashicorp/tfc-agent:latest",
  agent_single_execution: true,
  agent_auto_update: "minor",
  agent_egress_ports: ["443", "7146"],
  agent_cidr_blocks: ["0.0.0.0/0"],
  extra_env_vars: [],
  num_agents: 1,
  create_cloudwatch_log_group: true,
  cloudwatch_log_group_retention: 365,
  cloudwatch_log_group_name: "/hcp/hcp-terraform-agent",
  create_ecs_cluster: true,
  ecs_cluster_arn: "arn:aws:ecs:us-west-2:000000000000:cluster/ecs-basic",
  use_spot_instances: false,
  task_policy_arns: [],
  kms_key_arn: "",
  assign_public_ip: false,
  tags: {
    Terraform: "true",
    ManagedBy: "aws-ia/terraform-aws-tf-cloud-agents",
    Project: "LAagent",
  },
};

export const ACADEMY_TASK_POLICY_ARNS = [
  "arn:aws:iam::aws:policy/ReadOnlyAccess",
] as const;

export const MODULE_OUTPUTS = [
  "agent_pool_id",
  "agent_pool_name",
  "ecs_service_arn",
  "ecs_task_arn",
  "ecs_task_revision",
  "kms_key_arn",
  "log_stream_prefix",
  "security_group_id",
  "security_group_name",
  "task_role_arn",
  "task_role_name",
] as const;

export function isVpcId(value: string): boolean {
  return /^vpc-[a-zA-Z0-9]+$/.test(value);
}

export function isSubnetId(value: string): boolean {
  return /^subnet-[a-zA-Z0-9]+$/.test(value);
}

export function isEcsClusterArn(value: string): boolean {
  return /^arn:aws[a-z-]*:ecs:/.test(value);
}

export function validateTfCloudAgentInputs(input: TfCloudAgentInputs): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("name is required");
  if (!input.hcp_terraform_org_name.trim()) errors.push("hcp_terraform_org_name is required");
  if (!input.hcp_terraform_address.startsWith("https://")) {
    errors.push("hcp_terraform_address must start with https://");
  }
  if (!isVpcId(input.vpc_id)) errors.push("vpc_id must be a valid VPC ID");
  if (!input.subnet_ids.length || !input.subnet_ids.every(isSubnetId)) {
    errors.push("subnet_ids must be a list of valid subnet IDs");
  }
  if (input.agent_cpu < 256) errors.push("agent_cpu must be at least 256");
  if (input.agent_memory < 512) errors.push("agent_memory must be at least 512");
  if (!AGENT_LOG_LEVELS.includes(input.agent_log_level)) {
    errors.push("agent_log_level must be trace, debug, info, warn, or error");
  }
  if (!AGENT_AUTO_UPDATE.includes(input.agent_auto_update)) {
    errors.push("agent_auto_update must be minor, patch, or disabled");
  }
  if (!CLOUDWATCH_RETENTION_DAYS.includes(input.cloudwatch_log_group_retention as (typeof CLOUDWATCH_RETENTION_DAYS)[number])) {
    errors.push("cloudwatch_log_group_retention is not an allowed CloudWatch value");
  }
  if (!input.create_ecs_cluster && !isEcsClusterArn(input.ecs_cluster_arn)) {
    errors.push("ecs_cluster_arn must be a valid ECS cluster ARN when create_ecs_cluster is false");
  }
  if (!input.create_tfe_agent_pool && !input.tfe_agent_token.trim()) {
    errors.push("tfe_agent_token is required when create_tfe_agent_pool is false");
  }
  return errors;
}

function boolFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw == null || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function csv(env: NodeJS.ProcessEnv, name: string, fallback: string[]): string[] {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

export function tfCloudAgentInputsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TfCloudAgentInputs {
  return {
    ...TF_CLOUD_AGENT_DEFAULTS,
    name: env.TFC_AGENT_NAME?.trim() || "laagent-tfc",
    hcp_terraform_org_name: env.TFC_ORG_NAME?.trim() || "laagent-academy",
    vpc_id: env.AWS_VPC_ID?.trim() || "vpc-00000000000000000",
    subnet_ids: csv(env, "AWS_SUBNET_IDS", ["subnet-00000000000000000"]),
    aws_region: env.AWS_REGION?.trim() || env.AWS_DEFAULT_REGION?.trim() || TF_CLOUD_AGENT_DEFAULTS.aws_region,
    hcp_terraform_address: env.TFC_ADDRESS?.trim() || TF_CLOUD_AGENT_DEFAULTS.hcp_terraform_address,
    create_tfe_agent_pool: boolFromEnv(env, "TFC_CREATE_AGENT_POOL", true),
    tfe_agent_token: env.TFC_AGENT_TOKEN || env.TFE_TOKEN || env.TFC_TOKEN || "",
    tfe_agent_pool_name: env.TFC_AGENT_POOL_NAME?.trim() || "",
    agent_cpu: Number(env.TFC_AGENT_CPU ?? TF_CLOUD_AGENT_DEFAULTS.agent_cpu),
    agent_memory: Number(env.TFC_AGENT_MEMORY ?? TF_CLOUD_AGENT_DEFAULTS.agent_memory),
    agent_log_level: (env.TFC_AGENT_LOG_LEVEL as AgentLogLevel) || "info",
    agent_image: env.TFC_AGENT_IMAGE?.trim() || TF_CLOUD_AGENT_DEFAULTS.agent_image,
    agent_single_execution: boolFromEnv(env, "TFC_AGENT_SINGLE_EXECUTION", true),
    agent_auto_update: (env.TFC_AGENT_AUTO_UPDATE as AgentAutoUpdate) || "minor",
    num_agents: Number(env.TFC_NUM_AGENTS ?? 1),
    use_spot_instances: boolFromEnv(env, "TFC_USE_SPOT", false),
    assign_public_ip: boolFromEnv(env, "TFC_ASSIGN_PUBLIC_IP", false),
    create_ecs_cluster: boolFromEnv(env, "TFC_CREATE_ECS_CLUSTER", true),
    ecs_cluster_arn: env.TFC_ECS_CLUSTER_ARN?.trim() || TF_CLOUD_AGENT_DEFAULTS.ecs_cluster_arn,
    task_policy_arns: csv(env, "TFC_TASK_POLICY_ARNS", [...ACADEMY_TASK_POLICY_ARNS]),
    kms_key_arn: env.TFC_KMS_KEY_ARN?.trim() || "",
  };
}

export function toTerraformVars(input: TfCloudAgentInputs): Record<string, unknown> {
  return {
    name: input.name,
    hcp_terraform_org_name: input.hcp_terraform_org_name,
    hcp_terraform_address: input.hcp_terraform_address,
    aws_region: input.aws_region,
    vpc_id: input.vpc_id,
    subnet_ids: input.subnet_ids,
    create_tfe_agent_pool: input.create_tfe_agent_pool,
    tfe_agent_token: input.tfe_agent_token,
    tfe_agent_pool_name: input.tfe_agent_pool_name,
    agent_cpu: input.agent_cpu,
    agent_memory: input.agent_memory,
    agent_log_level: input.agent_log_level,
    agent_image: input.agent_image,
    agent_single_execution: input.agent_single_execution,
    agent_auto_update: input.agent_auto_update,
    agent_egress_ports: input.agent_egress_ports,
    agent_cidr_blocks: input.agent_cidr_blocks,
    extra_env_vars: input.extra_env_vars,
    num_agents: input.num_agents,
    create_cloudwatch_log_group: input.create_cloudwatch_log_group,
    cloudwatch_log_group_retention: input.cloudwatch_log_group_retention,
    cloudwatch_log_group_name: input.cloudwatch_log_group_name,
    create_ecs_cluster: input.create_ecs_cluster,
    ecs_cluster_arn: input.ecs_cluster_arn,
    use_spot_instances: input.use_spot_instances,
    task_policy_arns: input.task_policy_arns,
    kms_key_arn: input.kms_key_arn,
    assign_public_ip: input.assign_public_ip,
    tags: input.tags,
  };
}

export function moduleInvocationHcl(input: Pick<TfCloudAgentInputs, "name" | "hcp_terraform_org_name">): string {
  return `module "agent_pool" {
  source  = "${TF_CLOUD_AGENTS_REGISTRY}"
  version = "${TF_CLOUD_AGENTS_VERSION}"

  name                    = "${input.name}"
  hcp_terraform_org_name  = "${input.hcp_terraform_org_name}"
  agent_image             = "hashicorp/tfc-agent:latest"
  vpc_id                  = var.vpc_id
  subnet_ids              = var.subnet_ids
  task_policy_arns        = ["arn:aws:iam::aws:policy/ReadOnlyAccess"]
}`;
}
