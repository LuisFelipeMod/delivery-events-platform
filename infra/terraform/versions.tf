terraform {
  required_version = ">= 1.11.1"

  # Partial backend. CI runs `terraform init -backend=false`.
  # To plan or apply, copy backend.hcl.example and pass -backend-config.
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.59"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}
