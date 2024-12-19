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

        const parameterGroup = new rds.ParameterGroup(this, "AuroraServerlessParamGroup", {
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_13_12,
            }),
            parameters: {
                "rds.force_ssl": "1", // Ejemplo de configuración
            },
        });
        // Crear la base de datos Aurora Serverless
        this.dbCluster = new rds.ServerlessCluster(this, "AuroraServerlessCluster", {
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_13_12, // Usa la versión compatible
            }),
            vpc: props.vpc,
            credentials: rds.Credentials.fromSecret(this.dbCredentialsSecret),
            defaultDatabaseName: "metabase",
            parameterGroup, // Asignar el grupo de parámetros
            scaling: {
                autoPause: cdk.Duration.minutes(10),
                minCapacity: rds.AuroraCapacityUnit.ACU_2,
                maxCapacity: rds.AuroraCapacityUnit.ACU_2,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        
    }
}
