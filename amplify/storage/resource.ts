import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "tokkyokikiStorage",
  access: (allow) => ({
    "public/*": [allow.public.to(["read"])],
    "protected/{entity_id}/*": [
      allow.entity("identityId").to(["read", "write", "delete"]),
    ],
    "private/{entity_id}/*": [
      allow.entity("identityId").to(["read", "write", "delete"]),
    ],
  }),
});
