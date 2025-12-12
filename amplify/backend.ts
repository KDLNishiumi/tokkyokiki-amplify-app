import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { kintoneSync } from './api/resource.js';
import { storage } from './storage/resource.js';
import { Stack, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  kintoneSync,
  storage,
});

const isProduction = process.env.AWS_BRANCH === 'main';

// Lambda関数のリソースから Stack を取得
const lambdaFn = backend.kintoneSync.resources.lambda;
const stack = Stack.of(lambdaFn);

// Lambda Function URL を追加
const fnUrl = lambdaFn.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
    allowedHeaders: ['*'],
  },
});

// Function URL を CloudFormation Output として出力
new CfnOutput(stack, 'KintoneSyncFunctionUrl', {
  value: fnUrl.url,
  description: 'Kintone Sync Lambda Function URL',
});

// 本番環境のみVPC設定
if (isProduction) {
  // VPC作成
  const vpc = new ec2.Vpc(stack, 'KintoneVpc', {
    maxAzs: 2,
    natGateways: 1,
    subnetConfiguration: [
      {
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 24,
      },
      {
        name: 'Private',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        cidrMask: 24,
      },
    ],
  });

  // Elastic IP を NAT Gateway に割り当て
  const eip = new ec2.CfnEIP(stack, 'NatGatewayEIP', {
    domain: 'vpc',
  });

  // Security Group作成
  const securityGroup = new ec2.SecurityGroup(stack, 'LambdaSG', {
    vpc,
    allowAllOutbound: true,
  });

  // Lambda実行ロールにVPCアクセス権限を追加
  lambdaFn.role?.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
  );

  // Lambda関数のCfnリソースを取得してVPCに配置
  const cfnFunction = lambdaFn.node.defaultChild as lambda.CfnFunction;

  cfnFunction.vpcConfig = {
    subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    securityGroupIds: [securityGroup.securityGroupId],
  };
}

// カスタム出力を amplify_outputs.json に追加
backend.addOutput({
  custom: {
    kintoneSyncUrl: fnUrl.url,
  },
});
