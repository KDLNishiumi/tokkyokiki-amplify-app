import { defineFunction } from "@aws-amplify/backend";

export const kintoneSync = defineFunction({
  entry: "./handlers/kintone-sync.ts",
  environment: {
    ALLOW_ORIGIN: "*",
  },
});
