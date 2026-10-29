# Terraform

Reference stack for the runtime the services expect: VPC, EKS, RDS PostgreSQL, SNS, SQS with a DLQ, DynamoDB, ECR, and IRSA roles.

## Do not apply this casually

`terraform apply` creates resources AWS bills for as long as they exist. That includes the EKS control plane, a NAT gateway, a worker node, and an RDS instance. This repository's CI never applies the stack. It runs:

```bash
terraform init -backend=false -input=false
terraform fmt -check -recursive
terraform validate
```

`validate` checks the configuration. It does not talk to AWS and it does not mean an apply will succeed. Before any apply, confirm the Kubernetes version in `variables.tf` is still an EKS-supported version in your region, and read the current AWS pricing for EKS, NAT Gateway, EC2, and RDS.

When you are finished with a stack you did apply, destroy it. Deletion protection is on for the database, so a destroy requires changing that flag first.

## Backend

The S3 backend block is incomplete on purpose. Copy `backend.hcl.example`, fill in a bucket you already own, and initialize with:

```bash
terraform init -backend-config=backend.hcl
```

## Wiring the apps

After a real apply, the outputs map onto the process environment and the Helm values:

| Output | Where it goes |
| --- | --- |
| `order_created_topic_arn` | `SNS_TOPIC_ARN` |
| `order_created_queue_url` | `SQS_QUEUE_URL` |
| `fulfillments_table_name` | `DYNAMODB_TABLE` |
| `orders_db_endpoint` and `orders_db_secret_arn` | `DATABASE_URL` (password is in Secrets Manager) |
| `orders_irsa_role_arn` | annotation on service account `orders` |
| `fulfillment_irsa_role_arn` | annotation on service account `fulfillment` |
| `ecr_repository_urls` | image repositories; tags are immutable |

Local Compose uses shorter names (`order-created`, `fulfillments`) against LocalStack. The services do not hard-code either scheme.
