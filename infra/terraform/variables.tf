variable "aws_region" {
  description = "Region for every resource in this stack."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Short name used in resource names."
  type        = string
  default     = "delivery"
}

variable "environment" {
  description = "Environment suffix, for example dev or prod."
  type        = string
  default     = "dev"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version. Confirm it is still supported before apply."
  type        = string
  default     = "1.33"
}

variable "k8s_namespace" {
  description = "Namespace the Helm release is installed into. IRSA trust policies use it."
  type        = string
  default     = "delivery"
}
