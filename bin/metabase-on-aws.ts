#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MetabaseOnAwsStack } from '../lib/metabase-on-aws-stack';

const app = new cdk.App();
new MetabaseOnAwsStack(app, 'MetabaseStack', {
  env: { region: 'us-east-1' }, // Cambia la región según tu preferencia
});