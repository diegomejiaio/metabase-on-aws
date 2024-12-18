import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkingStack } from './networking-stack';
import { DataStack } from './data-stack';
import { ComputeStack } from './compute-stack';

export class MetabaseOnAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Crear la pila de red (VPC y subredes)
    const networkingStack = new NetworkingStack(this, 'NetworkingStack');

    // 2. Crear la pila de datos (Aurora Serverless)
    const dataStack = new DataStack(this, 'DataStack', {
      vpc: networkingStack.vpc, // Pasar la VPC de NetworkingStack
    });

    // 3. Crear la pila de cómputo (EC2 Spot para Metabase)
    new ComputeStack(this, 'ComputeStack', {
      vpc: networkingStack.vpc,                 // Pasar la VPC de NetworkingStack
      dbCluster: dataStack.dbCluster,           // Pasar el cluster de Aurora
      dbCredentialsSecret: dataStack.dbCredentialsSecret, // Pasar el secreto de la DB
    });
  }
}
