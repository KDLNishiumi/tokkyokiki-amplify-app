import { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { appId, records, domain, token } = body;

    const response = await fetch(
      `https://${domain}/k/v1/records.json`,
      {
        method: "POST",
        headers: {
          "X-Cybozu-API-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app: appId,
          records: records,
        }),
      }
    );

    const result = await response.json();

    return {
      statusCode: response.status,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Sync failed" }),
    };
  }
};
