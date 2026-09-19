import { DEFAULT_CAPTURE_PLAN } from "./capture-plan.ts";
import { isForbiddenCli, pillarsFor, slugify } from "./curriculum.ts";
import { extractLabNarratives, extractSafeCli } from "./extract.ts";
import type { CaptureStep, LearningObjective } from "./types.ts";

function cliForService(service: string): string {
  const map: Record<string, string> = {
    IAM: "aws iam create-role --role-name academy-workload-role --assume-role-policy-document file://trust.json",
    S3: "aws s3api create-bucket --bucket academy-lab-artifacts --region us-east-1",
    VPC: "aws ec2 create-vpc --cidr-block 10.20.0.0/16",
    Lambda:
      "aws lambda create-function --function-name academy-handler --runtime python3.12 --role arn:aws:iam::123456789012:role/academy-workload-role --handler app.lambda_handler --zip-file fileb://function.zip",
    CloudWatch:
      "aws cloudwatch put-metric-alarm --alarm-name academy-errors --metric-name Errors --namespace AWS/Lambda --statistic Sum --period 60 --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold --evaluation-periods 1",
    EC2: "aws ec2 describe-instances --filters Name=instance-state-name,Values=running",
  };
  return map[service] ?? `aws ${service.toLowerCase().replace(/\s+/g, "-")} help`;
}

export function buildCapturePlan(
  text: string,
  objectives: LearningObjective[],
): CaptureStep[] {
  const labs = extractLabNarratives(text);
  const cli = extractSafeCli(text).filter((command) => !isForbiddenCli(command));
  const steps: CaptureStep[] = [];

  for (const lab of labs.slice(0, 4)) {
    const narrative = lab.steps.join(" ");
    steps.push({
      index: steps.length + 1,
      slug: slugify(lab.title),
      title: lab.title.replace(/^Lab\s+\d+:\s*/i, ""),
      description:
        lab.steps.slice(0, 4).join(" ") ||
        "Complete the console workflow exactly as specified in the source lab.",
      caption: `${lab.title} console form before submit.`,
      selector: "[data-capture='panel']",
      route: `/step/${steps.length + 1}`,
      highlight: "[data-highlight='focus']",
      cliFallback: cli[steps.length],
      wellArchitectedPillars: pillarsFor(`${lab.title} ${narrative}`),
    });
    steps.push({
      index: steps.length + 1,
      slug: `${slugify(lab.title)}-verify`,
      title: `Verify ${lab.title.replace(/^Lab\s+\d+:\s*/i, "")}`,
      description:
        "Confirm the resource exists, redact account identifiers, and capture the success or runtime state used as instructional proof.",
      caption: "Success and verification surface after the lab action.",
      selector: "[data-capture='panel']",
      route: `/step/${steps.length + 1}`,
      cliFallback: cli[steps.length] ?? cli[0],
      wellArchitectedPillars: pillarsFor(`${lab.title} verify CloudWatch`),
    });
  }

  const rankedCli = cli
    .filter((command) => !/\b(delete|remove|list|get|describe|help)\b/i.test(command))
    .concat(cli.filter((command) => /\b(create|put|attach|update|enable)\b/i.test(command)));
  const uniqueCli = [...new Set(rankedCli)];

  for (const command of uniqueCli) {
    if (steps.length >= 8) break;
    if (steps.some((step) => step.cliFallback === command)) continue;
    const service = command.split(/\s+/)[1] ?? "iam";
    steps.push({
      index: steps.length + 1,
      slug: slugify(command.slice(0, 40)),
      title: `Execute ${service} lab command`,
      description: `Run the curriculum CLI without long-lived access keys: ${command}`,
      caption: `CLI and console replica for ${service}.`,
      selector: "[data-capture='panel']",
      route: `/step/${steps.length + 1}`,
      highlight: "[data-highlight='focus']",
      cliFallback: command,
      wellArchitectedPillars: pillarsFor(command),
    });
  }

  if (steps.length >= 4) {
    return steps.slice(0, 8).map((step, index) => ({
      ...step,
      index: index + 1,
      route: `/step/${index + 1}`,
    }));
  }

  const services = [...new Set(objectives.flatMap((objective) => objective.services))];
  if (services.includes("S3") && services.includes("VPC")) {
    return DEFAULT_CAPTURE_PLAN;
  }

  const synthesized = (services.length ? services : ["IAM", "Lambda", "CloudWatch"]).slice(0, 6);
  return synthesized.map((service, index) => ({
    index: index + 1,
    slug: slugify(`${service}-lab`),
    title: `Configure ${service} from the source curriculum`,
    description: `Apply the ${service} learning objectives from the ingested Uday AWS notes using least privilege and no root credentials.`,
    caption: `${service} console replica with highlighted configuration.`,
    selector: "[data-capture='panel']",
    route: `/step/${index + 1}`,
    highlight: "[data-highlight='focus']",
    cliFallback: cliForService(service),
    wellArchitectedPillars: pillarsFor(service),
  }));
}
