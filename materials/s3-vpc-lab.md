# Private S3 access from a VPC (AWS Academy lab)

## Learning goals
Students will create a private Amazon S3 bucket, lock public access, place a sample workload in private subnets, and reach the bucket through a gateway VPC endpoint. IAM policies must follow least privilege. Verification uses CloudWatch metrics and a CLI GetObject from an instance without a public IP.

## Core services
IAM, VPC, S3, CloudWatch

## Procedure
1. Create an IAM lab role that can only list and read a named bucket. Do not attach AdministratorAccess.
2. Create a VPC with two private subnets in different Availability Zones. Do not attach an internet gateway route to those subnets.
3. Create an S3 bucket with Block Public Access enabled and default encryption.
4. Create a gateway VPC endpoint for S3 and update the private route tables.
5. Attach an endpoint policy that allows s3:GetObject only from the lab VPC.
6. From a private instance, run aws s3 cp and confirm the object download. Check CloudWatch request metrics.

## Skip gate
Intermediate students who can already explain gateway vs interface endpoints and write a bucket policy with aws:SourceVpce may skip the VPC primer and start at endpoint policy authoring.
