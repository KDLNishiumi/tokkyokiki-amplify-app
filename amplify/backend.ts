import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { kintoneSync, userSignUp, bulkInvite } from './api/resource.js';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

const backend = defineBackend({
  auth,
  kintoneSync,
  userSignUp,
  bulkInvite,
});

const isProduction = process.env.AWS_BRANCH === 'production';

const lambdaFn = backend.kintoneSync.resources.lambda;
const stack = Stack.of(lambdaFn);

const fnUrl = lambdaFn.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.AWS_IAM,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
    allowedHeaders: ['*'],
  },
});

const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;
authenticatedRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunctionUrl'],
    resources: [lambdaFn.functionArn],
  })
);

// signup 用 Lambda の設定
const signUpFn = backend.userSignUp.resources.lambda;

const signUpFnUrl = signUpFn.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    // Function URL の CORS では OPTIONS は指定不可
    allowedMethods: [lambda.HttpMethod.POST],
    allowedHeaders: ['*'],
  },
});

// Lambda が Cognito サインアップ API を呼べるように権限付与
signUpFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:SignUp'],
    resources: ['*'],
  })
);

backend.addOutput({
  custom: {
    kintoneSyncUrl: fnUrl.url,
    userSignUpUrl: signUpFnUrl.url,
  },
});

// bulk invite Lambda 用 IAM 権限
const bulkInviteFn = backend.bulkInvite.resources.lambda;
bulkInviteFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword'],
    resources: ['*'],
  })
);
bulkInviteFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);
// 招待用バケットを作成し、アップロードで Lambda をトリガー
const inviteBucket = new s3.Bucket(stack, 'InviteBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: RemovalPolicy.RETAIN,
});
inviteBucket.grantRead(bulkInviteFn);
const bulkInviteFunction = bulkInviteFn as unknown as lambda.Function;
bulkInviteFunction.addEnvironment('INVITE_BUCKET', inviteBucket.bucketName);
inviteBucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(bulkInviteFn)
);

// production環境のみVPC設定
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
