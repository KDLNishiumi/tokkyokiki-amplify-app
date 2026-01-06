import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Readable } from "stream";

const userPoolId = process.env.USER_POOL_ID!;
const inviteBucket = process.env.INVITE_BUCKET;
const fromEmail = process.env.FROM_EMAIL || "";
const serviceName = process.env.SERVICE_NAME || "ご利用サービス";
const loginUrl = process.env.LOGIN_URL || "http://localhost:3000/";

const cognito = new CognitoIdentityProviderClient({});
const s3 = new S3Client({});
const ses = new SESv2Client({});

type Payload = { emails?: string[]; csv?: string };

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

// 簡易 CSV パーサ（1列目 email のみ想定, BOM除去, 重複除去）
function parseCsv(csv: string): string[] {
  const seen = new Set<string>();
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^\uFEFF/, "")) // BOM除去
    .filter((l) => l.length > 0);

  return lines
    .filter((l, idx) => !(idx === 0 && l.toLowerCase().includes("email"))) // ヘッダー行スキップ
    .map((l) => l.split(",")[0].trim())
    .filter((email) => {
      if (!email) return false;
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

function generateTempPassword(): string {
  // Cognito ポリシー（大文字/小文字/数字/記号を各1つ以上、長さ12）のパスワードを生成
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@$%&*";
  const all = upper + lower + digits + symbols;

  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];

  const remainingLength = 12 - required.length;
  const rest = Array.from({ length: remainingLength }, () => pick(all));

  // シャッフル
  const pwdArray = [...required, ...rest];
  for (let i = pwdArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwdArray[i], pwdArray[j]] = [pwdArray[j], pwdArray[i]];
  }

  return pwdArray.join("");
}

async function loadCsvFromS3(key: string): Promise<string> {
  if (!inviteBucket) throw new Error("INVITE_BUCKET is not set");
  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: inviteBucket,
      Key: key,
    })
  );
  const body = obj.Body as Readable | undefined;
  if (!body) throw new Error("S3 object body is empty");

  // convert stream to string (Node.js 18+)
  if (typeof (body as any).transformToString === "function") {
    return await (body as any).transformToString();
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function sendInviteMail(to: string, tempPassword: string) {
  if (!fromEmail) {
    console.log("FROM_EMAIL is not set; skipping email send.");
    return;
  }

  const subject = `【${serviceName}】アカウントが作成されました`;
  const body = [
    "こんにちは。",
    "",
    "以下の情報でアカウントを作成しました。",
    `ユーザー名: ${to}`,
    `一時パスワード: ${tempPassword}`,
    "",
    `ログインURL: ${loginUrl}`,
    "",
    "初回サインイン時に新しいパスワードへ変更してください。",
    "このメールに心当たりがない場合は破棄してください。",
  ].join("\n");

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: { Text: { Data: body } },
        },
      },
    })
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // S3 トリガー（ObjectCreated）に対応
  if ((event as any).Records?.[0]?.s3) {
    const record = (event as any).Records[0].s3;
    const key = decodeURIComponent(record.object.key.replace(/\+/g, " "));
    try {
      const csv = await loadCsvFromS3(key);
      const emails = parseCsv(csv);
      const results: Array<{ email: string; status: string; message?: string }> = [];
      console.log(JSON.stringify({ source: `s3://${inviteBucket}/${key}`, total: emails.length, emails }));

      for (const email of emails) {
        const tempPassword = generateTempPassword();
        try {
          await cognito.send(
            new AdminCreateUserCommand({
              UserPoolId: userPoolId,
              Username: email,
              TemporaryPassword: tempPassword,
              MessageAction: "SUPPRESS",
              UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" },
              ],
            })
          );
          await sendInviteMail(email, tempPassword);
          results.push({ email, status: "created" });
          console.log(`created user ${email}`);
        } catch (err: any) {
          results.push({ email, status: "error", message: err?.message });
          console.log(`error user ${email}: ${err?.message}`);
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ count: results.length, results, source: `s3://${inviteBucket}/${key}` }),
      };
    } catch (error: any) {
      console.log(`S3 processing failed: ${error?.message}`);
      return { statusCode: 500, body: JSON.stringify({ error: error?.message || "S3 processing failed" }) };
    }
  }

  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.requestContext.http.method !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method not allowed" };
  }

  try {
    const body: Payload = JSON.parse(event.body || "{}");
    let emails: string[] = [];

    if (Array.isArray(body.emails)) {
      emails = body.emails.map((e) => `${e}`.trim()).filter(Boolean);
    } else if (body.csv) {
      emails = parseCsv(body.csv);
    }

    if (!emails.length) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "emails or csv is required" }),
      };
    }

    const results: Array<{ email: string; status: string; message?: string }> = [];
    console.log(JSON.stringify({ source: "http", total: emails.length, emails }));

    for (const email of emails) {
      const tempPassword = generateTempPassword();
      try {
          await cognito.send(
            new AdminCreateUserCommand({
              UserPoolId: userPoolId,
              Username: email,
              TemporaryPassword: tempPassword,
              MessageAction: "SUPPRESS",
              UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" },
              ],
            })
          );
        await sendInviteMail(email, tempPassword);
        results.push({ email, status: "created" });
        console.log(`created user ${email}`);
      } catch (err: any) {
        results.push({ email, status: "error", message: err?.message });
        console.log(`error user ${email}: ${err?.message}`);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ count: results.length, results }),
    };
  } catch (error: any) {
    console.log(`bulk invite failed: ${error?.message}`);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error?.message || "Internal error" }),
    };
  }
};
