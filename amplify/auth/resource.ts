import { defineAuth } from "@aws-amplify/backend";

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  multifactor: {
    mode: "OPTIONAL",
    totp: true,
  },
  accountRecovery: "EMAIL_ONLY",
});
