import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface ComputeStackProps extends cdk.StackProps {
    vpc: ec2.Vpc; // VPC existente
    dbCluster: rds.ServerlessCluster; // Clúster de Aurora Serverless
    dbCredentialsSecret: secretsmanager.Secret; // Secreto de la DB
}

export class ComputeStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ComputeStackProps) {
        super(scope, id, props);

        // 1. Grupo de Seguridad para la instancia EC2
        const instanceSecurityGroup = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {
            vpc: props.vpc,
            description: 'Permitir acceso HTTP a Metabase',
            allowAllOutbound: true,
        });

        instanceSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3000), 'Permitir acceso HTTP a Metabase');

        // 2. Rol IAM para la instancia EC2
        const instanceRole = new iam.Role(this, 'InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'), // Acceso básico a SSM
            ],
            inlinePolicies: {
                MetabasePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                'secretsmanager:GetSecretValue',
                                'ssm:GetParameter',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
            },
        });

        // 3. Seleccionar una Subred Válida de la VPC
        const subnets = props.vpc.selectSubnets({
            subnetType: ec2.SubnetType.PUBLIC, // Selecciona subredes públicas
        }).subnetIds;

        const subnetId = subnets[0]; // Usa la primera subred pública

        // 4. Script de Datos de Usuario para Instalar y Ejecutar Metabase
        const METABASE_VERSION = 'v0.51.8';
        const userDataScript = ec2.UserData.forLinux();
        userDataScript.addCommands(
            'yum update -y',
            // Extraer valores desde Secrets Manager y configurarlos como variables de entorno
            `DB_SECRET=$(aws secretsmanager get-secret-value --secret-id ${props.dbCredentialsSecret.secretName} --query 'SecretString' --output text)`,
            `DB_PASS=$(echo $DB_SECRET | jq -r '.password')`,
            `DB_HOST=$(echo $DB_SECRET | jq -r '.host')`,
            `DB_PORT=$(echo $DB_SECRET | jq -r '.port')`,
            `DB_USER=$(echo $DB_SECRET | jq -r '.username')`,
            `DB_NAME=$(echo $DB_SECRET | jq -r '.dbname')`,
            // Validar que se obtuvieron todos los valores
            `if [ -z "$DB_PASS" ] || [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then echo "Error: No se pudo obtener toda la información del secreto" >&2; exit 1; fi`,
            `echo "export MB_DB_PASS=$DB_PASS" >> /etc/environment`,
            `echo "export MB_DB_TYPE=postgres" >> /etc/environment`,
            `echo "export MB_DB_HOST=$DB_HOST" >> /etc/environment`,
            `echo "export MB_DB_PORT=$DB_PORT" >> /etc/environment`,
            `echo "export MB_DB_USER=$DB_USER" >> /etc/environment`,
            `echo "export MB_DB_NAME=$DB_NAME" >> /etc/environment`,
            // Iniciar Metabase automáticamente
            'yum install -y aws-cli jq java-17-amazon-corretto-headless',
            `wget https://downloads.metabase.com/${METABASE_VERSION}/metabase.jar -O /home/ec2-user/metabase.jar`,
            'chown ec2-user:ec2-user /home/ec2-user/metabase.jar',
            // Configurar la región de AWS
            `export AWS_DEFAULT_REGION=us-east-1`,
            `echo "java -jar /home/ec2-user/metabase.jar" > /etc/rc.local`,
            'chmod +x /etc/rc.local',
            '/etc/rc.local'
        );

        // 5. Launch Template para la Instancia EC2
        const launchTemplate = new ec2.CfnLaunchTemplate(this, 'MetabaseLaunchTemplate', {
            launchTemplateData: {
                instanceType: 't4g.medium',
                imageId: new ec2.AmazonLinuxImage({
                    generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
                    cpuType: ec2.AmazonLinuxCpuType.ARM_64,
                }).getImage(this).imageId,
                keyName: 'diego-mac-keys', // Clave SSH
                iamInstanceProfile: {
                    name: new iam.CfnInstanceProfile(this, 'InstanceProfile', {
                        roles: [instanceRole.roleName],
                    }).ref,
                },
                securityGroupIds: [instanceSecurityGroup.securityGroupId],
                instanceMarketOptions: {
                    marketType: 'spot',
                    spotOptions: {
                        maxPrice: '0.015',
                    },
                },
                userData: cdk.Fn.base64(userDataScript.render()),
            },
        });

        // 6. Crear la Instancia EC2 en una Subred Correcta
        const spotInstance = new ec2.CfnInstance(this, 'MetabaseSpotInstance', {
            launchTemplate: {
                launchTemplateId: launchTemplate.ref,
                version: launchTemplate.attrLatestVersionNumber,
            },
            subnetId: subnetId, // Especifica la subred correcta
        });

        // 7. Salida con la IP Pública
        new cdk.CfnOutput(this, 'InstancePublicIP', {
            value: spotInstance.attrPublicIp,
            description: 'Dirección IP pública de la instancia Spot',
        });
    }
}
