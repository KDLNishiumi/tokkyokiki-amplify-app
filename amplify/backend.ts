import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { kintoneSync } from './api/resource.js';
import { storage } from './storage/resource.js';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';

const backend = defineBackend({
  auth,
  data,
  kintoneSync,
  storage,
});

const stack = Stack.of(backend);

// Lambda 実行ロール
const lambdaRole = new iam.Role(stack, 'LambdaExecutionRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});

// Secrets Manager アクセス権限
lambdaRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: ['secretsmanager:GetSecretValue'],
    resources: ['arn:aws:secretsmanager:*:*:secret:/amplify/kintone/*'],
  })
);

// VPC アクセス権限
lambdaRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: [
      'ec2:CreateNetworkInterface',
      'ec2:DescribeNetworkInterfaces',
      'ec2:DeleteNetworkInterface',
    ],
    resources: ['*'],
  })
);

// CloudWatch Logs 権限
lambdaRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    resources: ['arn:aws:logs:*:*:*'],
  })
);

// DynamoDB アクセス権限
lambdaRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: ['dynamodb:*'],
    resources: ['*'],
  })
);
