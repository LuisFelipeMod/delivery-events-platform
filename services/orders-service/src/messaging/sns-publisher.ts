import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { Config } from "../config.js";
import type { OrderCreatedEvent, OrderPublisher } from "./events.js";

export class SnsOrderPublisher implements OrderPublisher {
  private readonly client: SNSClient;

  constructor(
    private readonly topicArn: string,
    client?: SNSClient,
    config?: Pick<Config, "awsRegion" | "awsEndpointUrl">,
  ) {
    this.client =
      client ??
      new SNSClient({
        region: config?.awsRegion ?? "us-east-1",
        ...(config?.awsEndpointUrl ? { endpoint: config.awsEndpointUrl } : {}),
      });
  }

  async publish(event: OrderCreatedEvent): Promise<void> {
    await this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify(event),
        MessageAttributes: {
          eventType: { DataType: "String", StringValue: event.eventType },
          eventId: { DataType: "String", StringValue: event.eventId },
        },
      }),
    );
  }
}
