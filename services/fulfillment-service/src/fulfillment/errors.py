class InvalidMessage(Exception):
    """The SQS body cannot be processed. Leave it for the redrive policy."""
