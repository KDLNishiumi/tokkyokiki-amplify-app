import { defineFunction } from "@aws-amplify/backend";

const isProduction = process.env.AWS_BRANCH === 'main';

const functionConfig: any = {
  entry: "./handlers/kintone-sync.ts",
};

if (isProduction) {
  functionConfig.vpc = {
    vpcId: process.env.VPC_ID,
    subnetIds: [process.env.SUBNET_ID_1, process.env.SUBNET_ID_2],
  };
}

export const kintoneSync = defineFunction(functionConfig);
