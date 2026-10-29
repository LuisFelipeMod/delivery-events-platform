resource "aws_sns_topic" "order_created" {
  name = "${var.project}-${var.environment}-order-created"
}

resource "aws_sqs_queue" "order_created_dlq" {
  name                      = "${var.project}-${var.environment}-order-created-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "order_created" {
  name                       = "${var.project}-${var.environment}-order-created"
  visibility_timeout_seconds = 30
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_created_dlq.arn
    maxReceiveCount     = 5
  })
}

data "aws_iam_policy_document" "order_created_queue" {
  statement {
    sid     = "AllowTopic"
    effect  = "Allow"
    actions = ["sqs:SendMessage"]

    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }

    resources = [aws_sqs_queue.order_created.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.order_created.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "order_created" {
  queue_url = aws_sqs_queue.order_created.id
  policy    = data.aws_iam_policy_document.order_created_queue.json
}

resource "aws_sns_topic_subscription" "order_created" {
  topic_arn            = aws_sns_topic.order_created.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.order_created.arn
  raw_message_delivery = false
}
