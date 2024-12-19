import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NetworkingStack } from "./networking-stack";
import { DataStack } from "./data-stack";
import { ComputeStack } from "./compute-stack";

export class MetabaseOnAwsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1. Create the networking stack
        const networkingStack = new NetworkingStack(this, "NetworkingStack");

        // 2. Create the data stack
        const dataStack = new DataStack(this, "DataStack", {
            vpc: networkingStack.vpc,
        });

        // 3. Create the compute stack (Metabase app ec2 spot instance)
        const computeStack = new ComputeStack(this, "ComputeStack", {
            vpc: networkingStack.vpc,
            metabaseVersion: "v0.51.8", // Nueva versión
        });

        // Define explicit dependency between stacks
        computeStack.addDependency(dataStack);
    }
}

