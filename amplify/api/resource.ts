import { defineFunction } from "@aws-amplify/backend";

export const kintoneSync = defineFunction({
  name: "kintoneSync",
  entry: "./handlers/kintone-sync.ts",
  vpc: {
    natGateway: "single",
  },
});

kintoneSync.addEnvironment("AWS_REGION", "ap-northeast-1");
