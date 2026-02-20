import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { kintoneSync, userSignUp, bulkInvite } from './api/resource.js';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2i from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2a from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { CdkGraph } from '@aws/pdk/cdk-graph';
import { CdkGraphDiagramPlugin } from '@aws/pdk/cdk-graph-plugin-diagram';

const backend = defineBackend({
  auth,
  kintoneSync,
  userSignUp,
  bulkInvite,
});

const isProduction = process.env.AWS_BRANCH === 'production';

const lambdaFn = backend.kintoneSync.resources.lambda;
const signUpFn = backend.userSignUp.resources.lambda;
const stack = Stack.of(lambdaFn);

const cdkGraphArg = process.argv.find(
  arg => arg === '--cdk-graph' || arg.startsWith('--cdk-graph=')
);
const cdkGraphArgValue =
  cdkGraphArg && cdkGraphArg.includes('=') ? cdkGraphArg.split('=')[1] : '';
const isCdkGraphEnabledByArg =
  cdkGraphArg === '--cdk-graph' ||
  cdkGraphArgValue === '1' ||
  cdkGraphArgValue === 'true';
const isCdkGraphEnabledByEnv =
  process.env.CDK_GRAPH === '1' || process.env.CDK_GRAPH === 'true';
const isCdkGraphEnabled = isCdkGraphEnabledByArg || isCdkGraphEnabledByEnv;
let cdkGraph: CdkGraph | undefined;
if (isCdkGraphEnabled) {
  const appRoot = stack.node.root;
  cdkGraph = new CdkGraph(appRoot as any, {
    plugins: [new CdkGraphDiagramPlugin()],
  });
  process.once('beforeExit', async () => {
    if (!cdkGraph?.graphContext) {
      return;
    }
    try {
      await cdkGraph.report();
    } catch (error) {
      console.warn('[CdkGraph] report failed:', error);
    }
  });
}

const api = new apigwv2.HttpApi(stack, 'BackendHttpApi', {
  corsPreflight: {
    allowOrigins: ['*'],
    allowMethods: [
      apigwv2.CorsHttpMethod.GET,
      apigwv2.CorsHttpMethod.POST,
      apigwv2.CorsHttpMethod.OPTIONS,
    ],
    allowHeaders: ['*'],
  },
});

const iamAuthorizer = new apigwv2a.HttpIamAuthorizer();
const kintoneRoutes = api.addRoutes({
  path: '/kintone-sync',
  methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
  integration: new apigwv2i.HttpLambdaIntegration('KintoneSyncIntegration', lambdaFn),
  authorizer: iamAuthorizer,
});
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;
for (const route of kintoneRoutes) {
  route.grantInvoke(authenticatedRole);
}

api.addRoutes({
  path: '/user-signup',
  methods: [apigwv2.HttpMethod.POST],
  integration: new apigwv2i.HttpLambdaIntegration('UserSignUpIntegration', signUpFn),
});

// Lambda が Cognito サインアップ API を呼べるように権限付与
signUpFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:SignUp'],
    resources: ['*'],
  })
);

const apiBaseUrlRaw = api.url ?? api.apiEndpoint;
const apiBaseUrl = apiBaseUrlRaw.endsWith('/') ? apiBaseUrlRaw : `${apiBaseUrlRaw}/`;

backend.addOutput({
  custom: {
    apiBaseUrl,
    kintoneSyncUrl: `${apiBaseUrl}kintone-sync`,
    userSignUpUrl: `${apiBaseUrl}user-signup`,
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
  // 固定送信元IP用の Elastic IP
  const natEip = new ec2.CfnEIP(stack, 'NatGatewayEIP', {
    domain: 'vpc',
  });

  // VPC作成
  const vpc = new ec2.Vpc(stack, 'KintoneVpc', {
    maxAzs: 2,
    natGateways: 1,
    natGatewayProvider: ec2.NatProvider.gateway({
      eipAllocationIds: [natEip.ref],
    }),
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

  // Security Group作成
  const securityGroup = new ec2.SecurityGroup(stack, 'LambdaSG', {
    vpc,
    allowAllOutbound: true,
  });

  const attachLambdaToVpc = (targetLambda: lambda.IFunction) => {
    targetLambda.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );
    const cfnFunction = targetLambda.node.defaultChild as lambda.CfnFunction;
    cfnFunction.vpcConfig = {
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      securityGroupIds: [securityGroup.securityGroupId],
    };
  };

  // 本番時はすべての業務 Lambda を VPC 配置
  attachLambdaToVpc(lambdaFn);
  attachLambdaToVpc(signUpFn);
  attachLambdaToVpc(bulkInviteFunction);
}
