import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

interface DataStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
}

export class DataStack extends cdk.Stack {
    public readonly dbCluster: rds.ServerlessCluster;
    public readonly dbCredentialsSecret: secretsmanager.Secret;

    constructor(scope: Construct, id: string, props: DataStackProps) {
        super(scope, id, props);

        // Crear un secreto para las credenciales de la base de datos
        this.dbCredentialsSecret = new secretsmanager.Secret(
            this,
            "DBCredentialsSecret",
            {
                secretName: "AuroraDBCredentials",
                generateSecretString: {
                    secretStringTemplate: JSON.stringify({ username: "metabase" }),
                    generateStringKey: "password",
                    excludeCharacters: '"@/\\',
                },
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            },
            
        );

        // Crear la base de datos Aurora Serverless
        this.dbCluster = new rds.ServerlessCluster(
            this,
            "AuroraServerlessCluster",
            {
                engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
                vpc: props.vpc,
                credentials: rds.Credentials.fromSecret(this.dbCredentialsSecret),
                defaultDatabaseName: "metabase",
                scaling: {
                    autoPause: cdk.Duration.minutes(10),
                    minCapacity: 1,
                    maxCapacity: 2,
                },
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            }
        );
    }
}
