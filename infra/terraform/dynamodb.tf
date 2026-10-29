resource "aws_dynamodb_table" "fulfillments" {
  name         = "${var.project}-${var.environment}-fulfillments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"

  attribute {
    name = "orderId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}
