import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

interface DataStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
}

export class DataStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DataStackProps) {
        super(scope, id, props);

        const dbCredentialsSecret = new secretsmanager.Secret(
            this,
            "DBCredentialsSecret",
            {
                secretName: "AuroraDBCredentials",
                generateSecretString: {
                    secretStringTemplate: JSON.stringify({
                        username: "metabase",
                        dbname: "metabase",
                        port: 5432,
                        engine: "postgresql"
                    }),
                    generateStringKey: "password",
                    excludeCharacters: '"@/\\',
                },
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            }
        );

        // Aurora Serverless v2
        const dbCluster = new rds.DatabaseCluster(this, "AuroraServerlessV2Cluster", {
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_13_12,
            }),
            vpc: props.vpc,
            serverlessV2MinCapacity: 0.5,
            serverlessV2MaxCapacity: 1,
            writer: rds.ClusterInstance.serverlessV2("Writer"),
            credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
            defaultDatabaseName: "metabase",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Aurora Serverless v1
        // const dbCluster = new rds.ServerlessCluster(this, "AuroraServerlessCluster", {
        //     engine: rds.DatabaseClusterEngine.auroraPostgres({
        //         version: rds.AuroraPostgresEngineVersion.VER_13_12,
        //     }),
        //     vpc: props.vpc,
        //     credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
        //     scaling: {
        //         autoPause: cdk.Duration.minutes(5), // Auto pause after 5 minutes of inactivity
        //         minCapacity: rds.AuroraCapacityUnit.ACU_2, // Minimum capacity
        //         maxCapacity: rds.AuroraCapacityUnit.ACU_2, // Maximum capacity
        //     },
        //     defaultDatabaseName: "metabase",
        //     removalPolicy: cdk.RemovalPolicy.DESTROY,
        // });


        // Exporta los valores necesarios
        new cdk.CfnOutput(this, "DBClusterArn", {
            value: dbCluster.clusterArn, // Export ARN of the cluster
            exportName: "DBClusterArn",
        });

        new cdk.CfnOutput(this, "DBSecretArn", {
            value: dbCredentialsSecret.secretArn, // Export ARN of the secret
            exportName: "DBSecretArn",
        });

        new cdk.CfnOutput(this, "DBSecurityGroupId", {
            value: dbCluster.connections.securityGroups[0].securityGroupId,
            exportName: "DBSecurityGroupId",
        });
    }
}
