import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NetworkingStack } from "./networking-stack";
import { DataStack } from "./data-stack";
import { ComputeStack } from "./compute-stack";

export class MetabaseOnAwsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1. Crear la pila de red (VPC y subredes)
        const networkingStack = new NetworkingStack(this, "NetworkingStack");

        // 2. Crear la pila de datos (Aurora Serverless)
        const dataStack = new DataStack(this, "DataStack", {
            vpc: networkingStack.vpc,
        });

        // 3. Crear la pila de cómputo (EC2 Spot para Metabase)
        const computeStack = new ComputeStack(this, "ComputeStack", {
            vpc: networkingStack.vpc,
            metabaseVersion: "v0.51.9", // Nueva versión
        });

        // Definir la dependencia explícita: ComputeStack depende de DataStack
        computeStack.addDependency(dataStack);
    }
}

