import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "tokkyokikiStorage",
  access: (allow) => ({
    "public/*": [allow.guest.to(["read"])],
    "protected/{identity}/*": [
      allow.authenticated.to(["read", "write", "delete"]),
    ],
    "private/{identity}/*": [
      allow.authenticated.to(["read", "write", "delete"]),
    ],
  }),
});
