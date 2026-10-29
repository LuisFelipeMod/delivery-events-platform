from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    aws_region: str = "us-east-1"
    aws_endpoint_url: str | None = None
    sqs_queue_url: str = ""
    dynamodb_table: str = "fulfillments"
    poll_wait_seconds: int = 2
    visibility_timeout_seconds: int = 30
    poll_error_backoff_seconds: float = 2
    consumer_enabled: bool = True
    log_level: str = "info"
    cors_origins: str = "*"
