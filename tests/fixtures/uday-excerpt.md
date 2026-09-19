# Chapter 01 — AWS IAM (Identity & Access Management)

## 1. Learning Objectives

1. **Explain** how IAM users, groups, roles, and policies authorize S3 and Lambda calls.
2. **Create** IAM roles with least-privilege permissions for CloudWatch Logs.
3. **Configure** MFA on the root user and stop using root for daily work.
4. **Troubleshoot** AccessDenied errors with CloudTrail.
5. **Design** a production IAM strategy for a multi-team organization.

## 2. What is AWS IAM?

AWS IAM controls who can call S3, EC2, Lambda, and CloudWatch APIs.

## 10. Hands-on Labs

### Lab 1: Create a least-privilege Lambda execution role
1. Open IAM and choose Create role.
2. Trust lambda.amazonaws.com.
3. Attach CloudWatch Logs permissions only.
4. Name the role academy-lambda-role.

## 11. Code Examples

```bash
aws iam create-role --role-name academy-lambda-role --assume-role-policy-document file://lambda-trust.json
aws logs describe-log-groups --query logGroups[0].logGroupName
```
