// Synthesizes the Amplify Gen2 backend without deploying.
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '..');

process.env.CDK_GRAPH = process.env.CDK_GRAPH ?? '1';
process.env.CDK_OUTDIR =
  process.env.CDK_OUTDIR ?? path.join(rootDir, 'cdk.out');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
  name?: string;
};

const backendName = process.env.AMPLIFY_BACKEND_NAME ?? packageJson.name ?? 'backend';
const backendNamespace =
  process.env.AMPLIFY_BACKEND_NAMESPACE ?? process.env.USERNAME ?? 'local';
const deploymentType = process.env.AMPLIFY_BACKEND_TYPE ?? 'sandbox';

const contextKeys = {
  'amplify-backend-name': backendName,
  'amplify-backend-namespace': backendNamespace,
  'amplify-backend-type': deploymentType,
};

const existingContext = process.env.CDK_CONTEXT_JSON;
const mergedContext =
  existingContext && existingContext.trim().length > 0
    ? { ...JSON.parse(existingContext), ...contextKeys }
    : contextKeys;
process.env.CDK_CONTEXT_JSON = JSON.stringify(mergedContext);

void (async () => {
  await import('../amplify/backend.ts');
  // Trigger synth in Amplify's default App/Stack factory.
  process.emit('message', 'amplifySynth');
})();
