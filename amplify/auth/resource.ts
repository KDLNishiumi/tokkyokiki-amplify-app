import { defineAuth } from "@aws-amplify/backend";

export const auth = defineAuth({
  loginWith: {
    email: true,
    oauth: {
      scopes: ["email", "openid", "profile"],
      callbackUrls: [
        process.env.AMPLIFY_APP_URL || "http://localhost:3000/",
      ],
      logoutUrls: [
        process.env.AMPLIFY_APP_URL || "http://localhost:3000/",
      ],
    },
  },
  multifactor: {
    mode: "OPTIONAL",
    totp: true,
  },
  accountRecovery: "EMAIL_ONLY",
});
