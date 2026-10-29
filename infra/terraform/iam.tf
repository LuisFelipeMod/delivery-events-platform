data "aws_iam_policy_document" "orders_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      values   = ["system:serviceaccount:${var.k8s_namespace}:orders"]
    }
  }
}

resource "aws_iam_role" "orders" {
  name               = "${var.project}-${var.environment}-orders"
  assume_role_policy = data.aws_iam_policy_document.orders_assume.json
}

resource "aws_iam_role_policy" "orders_publish" {
  name = "publish-order-created"
  role = aws_iam_role.orders.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sns:Publish"]
      Resource = aws_sns_topic.order_created.arn
    }]
  })
}

data "aws_iam_policy_document" "fulfillment_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      values   = ["system:serviceaccount:${var.k8s_namespace}:fulfillment"]
    }
  }
}

resource "aws_iam_role" "fulfillment" {
  name               = "${var.project}-${var.environment}-fulfillment"
  assume_role_policy = data.aws_iam_policy_document.fulfillment_assume.json
}

resource "aws_iam_role_policy" "fulfillment_consume" {
  name = "consume-order-created"
  role = aws_iam_role.fulfillment.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility",
        ]
        Resource = [
          aws_sqs_queue.order_created.arn,
          aws_sqs_queue.order_created_dlq.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
        ]
        Resource = aws_dynamodb_table.fulfillments.arn
      },
    ]
  })
}
