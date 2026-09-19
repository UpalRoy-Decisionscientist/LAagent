terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    tfe = {
      source  = "hashicorp/tfe"
      version = ">= 0.54"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "tfe" {
  hostname = replace(var.hcp_terraform_address, "https://", "")
}

variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "name" { type = string }
variable "hcp_terraform_org_name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }

variable "hcp_terraform_address" {
  type    = string
  default = "https://app.terraform.io"
}

variable "create_tfe_agent_pool" {
  type    = bool
  default = true
}

variable "tfe_agent_token" {
  type      = string
  default   = ""
  sensitive = true
}

variable "tfe_agent_pool_name" {
  type    = string
  default = ""
}

variable "agent_cpu" {
  type    = number
  default = 256
}

variable "agent_memory" {
  type    = number
  default = 512
}

variable "agent_log_level" {
  type    = string
  default = "info"
}

variable "agent_image" {
  type    = string
  default = "hashicorp/tfc-agent:latest"
}

variable "agent_single_execution" {
  type    = bool
  default = true
}

variable "agent_auto_update" {
  type    = string
  default = "minor"
}

variable "agent_egress_ports" {
  type    = set(string)
  default = ["443", "7146"]
}

variable "agent_cidr_blocks" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "extra_env_vars" {
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "num_agents" {
  type    = number
  default = 1
}

variable "create_cloudwatch_log_group" {
  type    = bool
  default = true
}

variable "cloudwatch_log_group_retention" {
  type    = number
  default = 365
}

variable "cloudwatch_log_group_name" {
  type    = string
  default = "/hcp/hcp-terraform-agent"
}

variable "create_ecs_cluster" {
  type    = bool
  default = true
}

variable "ecs_cluster_arn" {
  type    = string
  default = "arn:aws:ecs:us-west-2:000000000000:cluster/ecs-basic"
}

variable "use_spot_instances" {
  type    = bool
  default = false
}

variable "task_policy_arns" {
  type    = list(string)
  default = ["arn:aws:iam::aws:policy/ReadOnlyAccess"]
}

variable "kms_key_arn" {
  type    = string
  default = ""
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

module "agent_pool" {
  source = "../vendor/terraform-aws-tf-cloud-agents"

  name                         = var.name
  hcp_terraform_org_name       = var.hcp_terraform_org_name
  hcp_terraform_address        = var.hcp_terraform_address
  vpc_id                       = var.vpc_id
  subnet_ids                   = var.subnet_ids
  create_tfe_agent_pool        = var.create_tfe_agent_pool
  tfe_agent_token              = var.tfe_agent_token
  tfe_agent_pool_name          = var.tfe_agent_pool_name
  agent_cpu                    = var.agent_cpu
  agent_memory                 = var.agent_memory
  agent_log_level              = var.agent_log_level
  agent_image                  = var.agent_image
  agent_single_execution       = var.agent_single_execution
  agent_auto_update            = var.agent_auto_update
  agent_egress_ports           = var.agent_egress_ports
  agent_cidr_blocks            = var.agent_cidr_blocks
  extra_env_vars               = var.extra_env_vars
  num_agents                   = var.num_agents
  create_cloudwatch_log_group  = var.create_cloudwatch_log_group
  cloudwatch_log_group_retention = var.cloudwatch_log_group_retention
  cloudwatch_log_group_name    = var.cloudwatch_log_group_name
  create_ecs_cluster           = var.create_ecs_cluster
  ecs_cluster_arn              = var.ecs_cluster_arn
  use_spot_instances           = var.use_spot_instances
  task_policy_arns             = var.task_policy_arns
  kms_key_arn                  = var.kms_key_arn
  assign_public_ip             = var.assign_public_ip
  tags                         = var.tags
}

output "agent_pool_id" { value = module.agent_pool.agent_pool_id }
output "agent_pool_name" { value = module.agent_pool.agent_pool_name }
output "ecs_service_arn" { value = module.agent_pool.ecs_service_arn }
output "ecs_task_arn" { value = module.agent_pool.ecs_task_arn }
output "ecs_task_revision" { value = module.agent_pool.ecs_task_revision }
output "log_stream_prefix" { value = module.agent_pool.log_stream_prefix }
output "security_group_id" { value = module.agent_pool.security_group_id }
output "security_group_name" { value = module.agent_pool.security_group_name }
output "task_role_arn" { value = module.agent_pool.task_role_arn }
output "task_role_name" { value = module.agent_pool.task_role_name }
output "kms_key_arn" { value = module.agent_pool.kms_key_arn }
