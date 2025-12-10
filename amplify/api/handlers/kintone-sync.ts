import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

let cachedSecrets: { domain: string; token: string } | null = null;

async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const domainSecret = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: "/amplify/kintone/domain" })
  );
  const tokenSecret = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: "/amplify/kintone/api-token" })
  );

  cachedSecrets = {
    domain: domainSecret.SecretString || "",
    token: tokenSecret.SecretString || "",
  };
  return cachedSecrets;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const { domain, token } = await getSecrets();
    const body = JSON.parse(event.body || "{}");
    const { appId, records } = body;

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
