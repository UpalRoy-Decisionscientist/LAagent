import type { CaptureStep } from "./types.ts";

export const DEFAULT_CAPTURE_PLAN: CaptureStep[] = [
  {
    index: 1,
    slug: "iam-role-form",
    title: "Create a least-privilege lab role",
    description:
      "In IAM, create academy-s3-reader. Attach an inline policy that allows s3:ListBucket on the bucket ARN and s3:GetObject on object ARNs only. Leave AdministratorAccess detached.",
    caption: "IAM create-role form with scoped S3 read actions highlighted before submit.",
    route: "/iam",
    selector: "[data-capture='iam-form']",
    highlight: "[data-highlight='policy']",
    cliFallback:
      "aws iam create-role --role-name academy-s3-reader --assume-role-policy-document file://ec2-trust.json && aws iam put-role-policy --role-name academy-s3-reader --policy-name s3-read --policy-document file://s3-read.json",
    wellArchitectedPillars: ["Security"],
  },
  {
    index: 2,
    slug: "iam-role-success",
    title: "Confirm the role ARN without exposing account secrets",
    description:
      "After creation, record the role name and redacted ARN. Treat the 12-digit account id as sensitive and keep it masked in every instructional screenshot.",
    caption: "IAM success banner with redacted role ARN.",
    route: "/iam/success",
    selector: "[data-capture='iam-success']",
    cliFallback: "aws iam get-role --role-name academy-s3-reader --query Role.Arn --output text",
    wellArchitectedPillars: ["Security"],
  },
  {
    index: 3,
    slug: "vpc-private-subnets",
    title: "Create multi-AZ private subnets",
    description:
      "Create lab-vpc (10.20.0.0/16) with private subnets in two Availability Zones. Do not add a 0.0.0.0/0 route to an internet gateway on these route tables.",
    caption: "VPC subnet table showing two private subnets and no IGW default route.",
    route: "/vpc",
    selector: "[data-capture='vpc-subnets']",
    cliFallback:
      "aws ec2 create-vpc --cidr-block 10.20.0.0/16 && aws ec2 create-subnet --vpc-id vpc-lab --cidr-block 10.20.1.0/24 --availability-zone us-east-1a",
    terraformFallback:
      'resource "aws_subnet" "private_a" { vpc_id = aws_vpc.lab.id cidr_block = "10.20.1.0/24" availability_zone = "us-east-1a" }',
    wellArchitectedPillars: ["Reliability", "Security"],
  },
  {
    index: 4,
    slug: "s3-bucket-create",
    title: "Create a private encrypted bucket",
    description:
      "Create academy-lab-artifacts with Block Public Access enabled, SSE-S3 default encryption, and bucket versioning on. Confirm the public-access settings panel before create.",
    caption: "S3 create-bucket wizard with Block Public Access and encryption enabled.",
    route: "/s3",
    selector: "[data-capture='s3-create']",
    highlight: "[data-highlight='bpa']",
    cliFallback:
      "aws s3api create-bucket --bucket academy-lab-artifacts --region us-east-1 && aws s3api put-public-access-block --bucket academy-lab-artifacts --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
    wellArchitectedPillars: ["Security"],
  },
  {
    index: 5,
    slug: "vpce-gateway",
    title: "Attach a gateway VPC endpoint for S3",
    description:
      "Create a Gateway endpoint for com.amazonaws.us-east-1.s3, associate both private route tables, and restrict the endpoint policy to the lab bucket ARN with aws:SourceVpc.",
    caption: "VPC endpoint create form with S3 gateway type and route-table associations.",
    route: "/vpc/endpoint",
    selector: "[data-capture='vpce']",
    highlight: "[data-highlight='policy']",
    cliFallback:
      "aws ec2 create-vpc-endpoint --vpc-id vpc-lab --service-name com.amazonaws.us-east-1.s3 --route-table-ids rtb-private-a rtb-private-b --policy-document file://vpce-s3.json",
    wellArchitectedPillars: ["Security", "Cost Optimization"],
  },
  {
    index: 6,
    slug: "s3-getobject-verify",
    title: "Download an object over the private path",
    description:
      "From a private instance with the lab role, run aws s3 cp. There is no public IP and no NAT. Success proves prefix-list routing through the gateway endpoint.",
    caption: "CLI terminal showing a successful private GetObject with redacted identifiers.",
    route: "/cli",
    selector: "[data-capture='cli']",
    cliFallback:
      "aws s3 cp s3://academy-lab-artifacts/readme.txt /tmp/readme.txt --region us-east-1",
    wellArchitectedPillars: ["Reliability", "Operational Excellence"],
  },
  {
    index: 7,
    slug: "cloudwatch-metrics",
    title: "Confirm S3 request metrics in CloudWatch",
    description:
      "Open the bucket request metrics. GetRequests should increment after the private copy. Use this as architecture verification rather than a screenshot of secrets.",
    caption: "CloudWatch metric widget for S3 GetRequests after the private copy.",
    route: "/cloudwatch",
    selector: "[data-capture='cw']",
    cliFallback:
      "aws cloudwatch get-metric-statistics --namespace AWS/S3 --metric-name GetRequests --dimensions Name=BucketName,Value=academy-lab-artifacts Name=FilterId,Value=EntireBucket --start-time 2026-01-01T00:00:00Z --end-time 2026-01-01T01:00:00Z --period 300 --statistics Sum",
    wellArchitectedPillars: ["Operational Excellence"],
  },
];
