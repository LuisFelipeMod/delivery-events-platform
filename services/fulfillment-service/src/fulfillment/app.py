import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from fulfillment.config import Settings
from fulfillment.consumer import poll_forever
from fulfillment.logging import configure_logging
from fulfillment.models import FulfillmentRecord
from fulfillment.store import DynamoFulfillmentStore, FulfillmentStore, dynamodb_table, sqs_client


def _public_status(record: FulfillmentRecord) -> dict[str, object]:
    return {
        "orderId": record.orderId,
        "eventId": record.eventId,
        "status": record.status,
        "customerName": record.customerName,
        "address": record.address,
        "itemCount": record.itemCount,
        "acceptedAt": record.acceptedAt,
    }


def create_app(
    settings: Settings | None = None,
    store: FulfillmentStore | None = None,
    sqs=None,
) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings
        if store is None:
            app.state.store = DynamoFulfillmentStore(dynamodb_table(settings))
        else:
            app.state.store = store
        app.state.sqs = sqs if sqs is not None else sqs_client(settings)
        app.state.consumer_enabled = settings.consumer_enabled
        stop = asyncio.Event()
        task: asyncio.Task[None] | None = None
        if settings.consumer_enabled:
            task = asyncio.create_task(poll_forever(stop, settings, app.state.sqs, app.state.store))
        yield
        stop.set()
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="fulfillment-service", version="0.1.0", lifespan=lifespan)
    origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health(request: Request) -> dict[str, str]:
        return {
            "status": "ok",
            "service": "fulfillment",
            "consumer": "enabled" if request.app.state.consumer_enabled else "disabled",
        }

    @app.get("/fulfillments/{order_id}")
    def get_fulfillment(order_id: str, request: Request) -> dict[str, object]:
        record = request.app.state.store.get(order_id)
        if record is None:
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        return _public_status(record)

    return app
