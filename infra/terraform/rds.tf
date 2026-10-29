module "orders_db" {
  source  = "terraform-aws-modules/rds/aws"
  version = "7.2.2"

  identifier = "${var.project}-${var.environment}-orders"

  engine               = "postgres"
  engine_version       = "16"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = "db.t4g.micro"

  allocated_storage = 20
  storage_encrypted = true

  db_name  = "orders"
  username = "orders_admin"
  port     = 5432

  manage_master_user_password = true

  multi_az               = false
  publicly_accessible    = false
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.orders_db.id]

  backup_retention_period = 7
  skip_final_snapshot     = true
  deletion_protection     = true

  tags = local.tags
}
