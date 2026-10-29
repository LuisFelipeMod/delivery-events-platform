# Spec: infrastructure

## Purpose

Describe the AWS resources the two services need, as Terraform that `terraform validate` accepts. Applying the stack is a separate, explicit decision because EKS, NAT, and RDS are billed while they exist.

## Layout

`infra/terraform` uses:

- `terraform-aws-modules/vpc/aws` 6.7.3
- `terraform-aws-modules/eks/aws` 21.29.0
- `terraform-aws-modules/rds/aws` 7.2.2
- The AWS provider `~> 6.59` for SNS, SQS, DynamoDB, ECR, IAM, and the database security group

Terraform `>= 1.11.1`. The S3 backend block is partial. `terraform init -backend=false` is the validation path. A real plan uses `backend.hcl.example` as a template.

## Resources

- VPC `10.42.0.0/16` in two availability zones, public subnets, private subnets, database subnets, one NAT gateway.
- EKS cluster named `delivery-dev` by default, public API endpoint, IRSA enabled, managed node group `t3.small` (min 1, desired 1, max 2), addons `vpc-cni`, `coredns`, `kube-proxy`, `eks-pod-identity-agent`.
- RDS PostgreSQL 16, `db.t4g.micro`, 20 GiB encrypted storage, database `orders`, username `orders_admin`, master password in Secrets Manager, not publicly accessible, deletion protection on, backups kept 7 days. The security group allows port 5432 from the EKS node security group.
- SNS topic `delivery-dev-order-created`.
- SQS queue `delivery-dev-order-created` with a DLQ `delivery-dev-order-created-dlq`, `maxReceiveCount` 5, visibility timeout 30 seconds. The queue policy allows that topic to send messages. The subscription does not use raw delivery.
- DynamoDB table `delivery-dev-fulfillments`, hash key `orderId`, on-demand, point-in-time recovery on.
- ECR repositories `delivery/orders-service` and `delivery/fulfillment-service`, immutable tags, scan on push.
- IAM roles for service accounts `system:serviceaccount:delivery:orders` (sns:Publish on the topic) and `system:serviceaccount:delivery:fulfillment` (SQS consume on the queue and DLQ, DynamoDB GetItem and PutItem on the table).

Defaults live in `variables.tf`: region `us-east-1`, project `delivery`, environment `dev`, Kubernetes version `1.33`, namespace `delivery`. Confirm the EKS version is still supported before any apply.

## Helm contract

The chart's service account names are `orders` and `fulfillment`. Install it into the namespace in `k8s_namespace` and annotate the accounts with the IRSA role outputs. The chart does not create AWS resources.

## What validation covers

`terraform fmt -check` and `terraform validate` after `terraform init -backend=false`. That checks configuration. It does not call AWS and does not prove an apply will succeed.

## Out of scope

No Terraform apply in CI. No production sizing, multi-region, or WAF. In-cluster Postgres in the Helm chart is a local kind convenience and is not part of this Terraform stack.
