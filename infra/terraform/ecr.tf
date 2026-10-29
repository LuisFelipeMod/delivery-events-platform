resource "aws_ecr_repository" "service" {
  for_each = toset(["orders-service", "fulfillment-service"])

  name                 = "${var.project}/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}
