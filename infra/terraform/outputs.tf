output "order_created_topic_arn" {
  description = "SNS topic orders-service publishes to. Set SNS_TOPIC_ARN to this."
  value       = aws_sns_topic.order_created.arn
}

output "order_created_queue_url" {
  description = "SQS queue fulfillment-service polls. Set SQS_QUEUE_URL to this."
  value       = aws_sqs_queue.order_created.url
}

output "order_created_dlq_url" {
  description = "Dead-letter queue for order.created."
  value       = aws_sqs_queue.order_created_dlq.url
}

output "fulfillments_table_name" {
  description = "DynamoDB table. Set DYNAMODB_TABLE to this."
  value       = aws_dynamodb_table.fulfillments.name
}

output "orders_db_endpoint" {
  description = "RDS hostname. The database name is orders."
  value       = module.orders_db.db_instance_endpoint
}

output "orders_db_secret_arn" {
  description = "Secrets Manager ARN of the RDS master password."
  value       = module.orders_db.db_instance_master_user_secret_arn
}

output "eks_cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "orders_irsa_role_arn" {
  description = "Annotate the orders service account with this role ARN."
  value       = aws_iam_role.orders.arn
}

output "fulfillment_irsa_role_arn" {
  description = "Annotate the fulfillment service account with this role ARN."
  value       = aws_iam_role.fulfillment.arn
}

output "ecr_repository_urls" {
  description = "ECR repository URLs keyed by service name."
  value       = { for name, repo in aws_ecr_repository.service : name => repo.repository_url }
}
