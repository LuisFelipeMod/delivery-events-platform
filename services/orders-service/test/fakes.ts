import type { OrderCreatedEvent, OrderPublisher } from "../src/messaging/events.js";

export class FakePublisher implements OrderPublisher {
  readonly events: OrderCreatedEvent[] = [];
  failTimes = 0;

  async publish(event: OrderCreatedEvent): Promise<void> {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      throw new Error("sns unavailable");
    }
    this.events.push(event);
  }
}
