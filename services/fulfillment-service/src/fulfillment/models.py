from typing import Literal

from pydantic import BaseModel, Field, field_validator


class OrderItem(BaseModel):
    sku: str
    name: str
    quantity: int = Field(ge=1)

    @field_validator("sku", "name")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value


class OrderPayload(BaseModel):
    id: str
    customerName: str
    address: str
    items: list[OrderItem] = Field(min_length=1)
    notes: str | None = None
    createdAt: str


class OrderCreatedEvent(BaseModel):
    eventId: str
    eventType: Literal["order.created"]
    occurredAt: str
    order: OrderPayload


class FulfillmentRecord(BaseModel):
    orderId: str
    eventId: str
    status: Literal["accepted"]
    customerName: str
    address: str
    itemCount: int
    itemsJson: str
    acceptedAt: str


class AcceptResult(BaseModel):
    created: bool
    record: FulfillmentRecord
