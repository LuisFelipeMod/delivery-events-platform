# Spec: web

## Purpose

A single page to create an order and see when fulfillment accepts it.

## Behavior

- Fields: customer name, address, one or more drinks, optional notes.
- The drink menu is fixed in the page: Espresso (`ESP`), Latte (`LAT`), Cold Brew (`CLD`), Masala Chai (`CHA`), Sparkling Water (`SPW`), Orange Juice (`OJ`). Quantity is an integer from 1 to 50.
- Submit sends `POST /orders` with a new UUID `Idempotency-Key`.
- The page lists orders placed in this browser session and polls `GET /fulfillments/{id}` every 2 seconds while any row is waiting. `404` means still waiting. `status: accepted` stops the wait for that row.
- API bases come from `VITE_ORDERS_API_URL` and `VITE_FULFILLMENT_API_URL`. When they are unset, the Vite dev server proxies `/orders-api` and `/fulfillment-api` to ports 3001 and 8000. The Compose image bakes `http://localhost:3001` and `http://localhost:8000` so the browser talks to the published ports.

## Out of scope

No account, no persistence of the on-screen list, no order history from the API. The page is a client of the two services, not a third backend.

## Acceptance

`npm run typecheck` and `npm run build` succeed. There is no browser test in CI.
