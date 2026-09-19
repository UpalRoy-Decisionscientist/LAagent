# HCP Terraform agents on Amazon ECS (AWS IA)

Root module that embeds [aws-ia/terraform-aws-tf-cloud-agents](https://github.com/aws-ia/terraform-aws-tf-cloud-agents) so curriculum pipelines reach AWS through an ECS Fargate agent **task role** instead of console passwords or long-lived access keys.

Vendored source (Apache-2.0): `terraform/vendor/terraform-aws-tf-cloud-agents`.

```bash
# Dry-run: write tfvars from the AWS credential chain / env
npm run aws:agents

# Live apply (operator-owned account only)
export AWS_PROFILE=academy
export AWS_VPC_ID=vpc-...
export AWS_SUBNET_IDS=subnet-...,subnet-...
export TFC_ORG_NAME=your-org
export TFC_TOKEN=...          # HCP Terraform API token, not an AWS console password
export AWS_TF_AGENTS_APPLY=1
npm run aws:agents
```

The TypeScript helpers in `shared/tf-cloud-agents.ts` and `agents/aws-tf-cloud-agents.ts` port the module’s input validations, defaults, and output names.
