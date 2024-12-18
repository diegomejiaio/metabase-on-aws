import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class NetworkingStack extends cdk.Stack {
    public readonly vpc: ec2.Vpc;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Crear una VPC con 2 zonas de disponibilidad
        this.vpc = new ec2.Vpc(this, 'MetabaseVpc', {
            maxAzs: 2,
        });
    }
}
