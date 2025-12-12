import { defineAuth } from "@aws-amplify/backend";

const getCallbackUrls = () => {
  const urls = ["http://localhost:3000/"];
  
  const appId = process.env.AWS_APP_ID;
  const branch = process.env.AWS_BRANCH || "main";
  const region = process.env.AWS_REGION || "us-east-1";
  
  if (appId) {
    urls.push(`https://${branch}.${appId}.amplifyapp.com/`);
  }
  
  return urls;
};

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: "Verify your email",
      verificationEmailBody: (code: () => string) => `Your verification code is ${code()}`,
    },
    externalProviders: {
      callbackUrls: getCallbackUrls(),
      logoutUrls: getCallbackUrls(),
    },
  },
  multifactor: {
    mode: "OPTIONAL",
    totp: true,
  },
  accountRecovery: "EMAIL_ONLY",
});
