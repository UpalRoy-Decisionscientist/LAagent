export const AWS_SERVICES = [
  "IAM",
  "STS",
  "KMS",
  "VPC",
  "S3",
  "EC2",
  "Lambda",
  "ECS",
  "ECR",
  "Fargate",
  "RDS",
  "DynamoDB",
  "CloudWatch",
  "CloudTrail",
  "API Gateway",
  "SQS",
  "SNS",
  "EventBridge",
  "CloudFormation",
  "CodePipeline",
  "CodeBuild",
  "CodeDeploy",
  "Route 53",
  "CloudFront",
  "Cognito",
  "Secrets Manager",
  "Systems Manager",
  "WAF",
  "GuardDuty",
  "Bedrock",
  "Step Functions",
] as const;

export const FORBIDDEN_CLI = [
  /aws\s+iam\s+create-access-key/i,
  /AdministratorAccess/,
  /AKIA[0-9A-Z]{16}/,
  /aws_secret_access_key/i,
  /TempP@ss/i,
  /password\s+'[^']+'/i,
];

export function isForbiddenCli(command: string): boolean {
  return FORBIDDEN_CLI.some((pattern) => pattern.test(command));
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "step";
}

export function pillarsFor(text: string): string[] {
  const pillars = new Set<string>();
  if (/iam|kms|mfa|encrypt|least.?privilege|policy/i.test(text)) pillars.add("Security");
  if (/vpc|multi-az|endpoint|failover|rds/i.test(text)) pillars.add("Reliability");
  if (/cloudwatch|cloudtrail|x-ray|log/i.test(text)) pillars.add("Operational Excellence");
  if (/lambda|graviton|cost|budget|s3/i.test(text)) pillars.add("Cost Optimization");
  if (pillars.size === 0) pillars.add("Operational Excellence");
  return [...pillars];
}
