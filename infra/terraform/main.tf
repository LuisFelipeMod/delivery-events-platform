locals {
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.7.3"

  name = "${var.project}-${var.environment}"
  cidr = "10.42.0.0/16"

  azs              = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets   = ["10.42.0.0/24", "10.42.1.0/24"]
  private_subnets  = ["10.42.10.0/24", "10.42.11.0/24"]
  database_subnets = ["10.42.20.0/24", "10.42.21.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = local.tags
}

resource "aws_security_group" "orders_db" {
  name        = "${var.project}-${var.environment}-orders-db"
  description = "PostgreSQL from the EKS node security group"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Postgres from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    description = "Allow outbound responses"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}
