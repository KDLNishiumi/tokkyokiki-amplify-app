import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { auth } from "../auth/resource.js";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
      isDone: a.boolean().default(false),
      owner: a.string(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(["read"]),
    ]),
  KintoneSync: a
    .model({
      recordId: a.string().required(),
      syncedAt: a.datetime(),
      status: a.enum(["PENDING", "SUCCESS", "FAILED"]),
      owner: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    apiKeyAuthorizationMode: {
      expiresInDays: 7,
    },
  },
});
