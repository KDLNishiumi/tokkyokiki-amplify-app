import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

// Function URL 側で CORS を付与するため、ここでは Origin を付けない
const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type,Authorization,x-api-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Preflight
  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.requestContext.http.method !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!process.env.USER_POOL_CLIENT_ID) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "User pool client id is not configured" }),
    };
  }

  // API キーによる簡易保護（kintone 側に保持して送出してもらう）
  const requiredKey = process.env.SIGNUP_API_KEY;
  const providedKey = event.headers?.["x-api-key"] || event.headers?.["X-Api-Key"];
  if (requiredKey && requiredKey !== providedKey) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "email と password は必須です" }),
      };
    }

    const signUpResult = await client.send(
      new SignUpCommand({
        ClientId: process.env.USER_POOL_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        userConfirmed: signUpResult.UserConfirmed ?? false,
        codeDeliveryDetails: signUpResult.CodeDeliveryDetails,
      }),
    };
  } catch (error: any) {
    console.error("signup error", error);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error?.message || "Sign up failed",
      }),
    };
  }
};
