import { defineFunction } from "@aws-amplify/backend";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
type AmplifyOutputs = {
  auth?: {
    user_pool_client_id?: string;
    user_pool_id?: string;
  };
};

const loadAmplifyOutputs = (): AmplifyOutputs => {
  try {
    // CI では amplify_outputs.json が存在しないため、存在時のみ読み込む
    return require("../../amplify_outputs.json") as AmplifyOutputs;
  } catch {
    return {};
  }
};

const outputs = loadAmplifyOutputs();
const userPoolClientId =
  process.env.AWS_USER_POOL_CLIENT_ID ?? outputs.auth?.user_pool_client_id ?? "";
// デプロイ時に値未設定でも動作するようダミーを投入（あとで環境変数で上書き可能）
const signUpApiKey = process.env.SIGNUP_API_KEY ?? "dummy-signup-key";
const userPoolId = process.env.AWS_USER_POOL_ID ?? outputs.auth?.user_pool_id ?? "";
const inviteBucket = process.env.INVITE_BUCKET ?? "";
const fromEmail = process.env.FROM_EMAIL ?? "nishiumi@kdl.co.jp";
const serviceName = process.env.SERVICE_NAME ?? "ご利用サービス";
const loginUrlEnv = process.env.LOGIN_URL ?? "http://localhost:5173/";

export const kintoneSync = defineFunction({
  entry: "./handlers/kintone-sync.ts",
  runtime: 22,
  environment: {
    ALLOW_ORIGIN: "*",
  },
});

export const userSignUp = defineFunction({
  entry: "./handlers/user-signup.ts",
  runtime: 22,
  environment: {
    ALLOW_ORIGIN: "*",
    USER_POOL_CLIENT_ID: userPoolClientId,
    SIGNUP_API_KEY: signUpApiKey,
  },
});

export const bulkInvite = defineFunction({
  entry: "./handlers/bulk-invite.ts",
  runtime: 22,
  environment: {
    USER_POOL_ID: userPoolId,
    INVITE_BUCKET: inviteBucket,
    FROM_EMAIL: fromEmail,
    SERVICE_NAME: serviceName,
    LOGIN_URL: loginUrlEnv,
  },
});
