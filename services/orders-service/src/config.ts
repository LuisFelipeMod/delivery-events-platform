export type Config = {
  host: string;
  port: number;
  databaseUrl: string;
  topicArn: string;
  awsRegion: string;
  awsEndpointUrl?: string;
  logLevel: string;
  corsOrigin: string | boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const topicArn = env.SNS_TOPIC_ARN;
  if (!topicArn) {
    throw new Error("SNS_TOPIC_ARN is required");
  }
  const port = env.PORT === undefined ? 3001 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }
  const awsEndpointUrl = env.AWS_ENDPOINT_URL?.trim();
  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port,
    databaseUrl,
    topicArn,
    awsRegion: env.AWS_REGION?.trim() || "us-east-1",
    ...(awsEndpointUrl ? { awsEndpointUrl } : {}),
    logLevel: env.LOG_LEVEL?.trim() || "info",
    corsOrigin: env.CORS_ORIGIN?.trim() || true,
  };
}
