import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

interface ComputeStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    metabaseVersion: string; // Parámetro para manejar versiones
}

export class ComputeStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ComputeStackProps) {
        super(scope, id, props);

        // Importar valores del DataStack
        const dbSecurityGroupId = cdk.Fn.importValue("DBSecurityGroupId");
        const dbSecretArn = cdk.Fn.importValue("DBSecretArn");

        // 1. Grupo de Seguridad para la instancia EC2
        const instanceSecurityGroup = new ec2.SecurityGroup(this, "InstanceSecurityGroup", {
            vpc: props.vpc,
            description: "Allow HTTP access to Metabase",
            allowAllOutbound: true,
        });

        instanceSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3000), "Allow HTTP to Metabase");

        // Asignar regla de ingreso para Aurora desde la EC2
        const dbSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, "ImportedDBSecurityGroup", dbSecurityGroupId);
        dbSecurityGroup.addIngressRule(instanceSecurityGroup, ec2.Port.tcp(5432), "Allow EC2 to connect to Aurora");

        // 2. Rol IAM para la instancia EC2
        const instanceRole = new iam.Role(this, "InstanceRole", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
            ],
            inlinePolicies: {
                MetabasePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                "secretsmanager:GetSecretValue",
                                "ssm:GetParameter",
                            ],
                            resources: [dbSecretArn], // Uso de importación para el secreto
                        }),
                    ],
                }),
            },
        });

        // 3. Seleccionar una Subred Válida de la VPC
        const subnets = props.vpc.selectSubnets({
            subnetType: ec2.SubnetType.PUBLIC,
        }).subnetIds;

        const subnetId = subnets[0]; // Usa la primera subred pública

        // 4. Script de Datos de Usuario para Instalar y Ejecutar Metabase
        const userDataScript = ec2.UserData.forLinux();
        userDataScript.addCommands(
            "yum update -y",
            "yum install -y aws-cli jq java-17-amazon-corretto-headless postgresql15",
            "export AWS_DEFAULT_REGION=us-east-1",
            `DB_SECRET=$(aws secretsmanager get-secret-value --secret-id ${dbSecretArn} --query 'SecretString' --output text)`,
            "export DB_HOST=$(echo $DB_SECRET | jq -r '.host')",
            "export DB_PORT=$(echo $DB_SECRET | jq -r '.port')",
            "export DB_USER=$(echo $DB_SECRET | jq -r '.username')",
            "export DB_PASS=$(echo $DB_SECRET | jq -r '.password')",
            "export DB_NAME=$(echo $DB_SECRET | jq -r '.dbname')",
            "cat << EOF > /home/ec2-user/metabase.env",
            "MB_DB_TYPE=postgres",
            "MB_DB_DBNAME=$DB_NAME",
            "MB_DB_USER=$DB_USER",
            "MB_DB_PASS=$DB_PASS",
            "MB_DB_HOST=$DB_HOST",
            "MB_DB_PORT=$DB_PORT",
            "EOF",
            "chown ec2-user:ec2-user /home/ec2-user/metabase.env",
            "chmod 600 /home/ec2-user/metabase.env",
            `wget https://downloads.metabase.com/${props.metabaseVersion}/metabase.jar -O /home/ec2-user/metabase.jar`,
            "chown ec2-user:ec2-user /home/ec2-user/metabase.jar",
            "chmod 755 /home/ec2-user/metabase.jar",
            "cat << EOF > /etc/systemd/system/metabase.service",
            "[Unit]",
            "Description=Metabase application service",
            "After=network.target",
            "[Service]",
            "Type=simple",
            "User=ec2-user",
            "EnvironmentFile=/home/ec2-user/metabase.env",
            "ExecStart=/usr/bin/java --add-opens java.base/java.nio=ALL-UNNAMED -jar /home/ec2-user/metabase.jar",
            "Restart=always",
            "[Install]",
            "WantedBy=multi-user.target",
            "EOF",
            "systemctl daemon-reload",
            "systemctl enable metabase",
            "systemctl start metabase"
        );

        // 5. Launch Template para la Instancia EC2
        const launchTemplate = new ec2.CfnLaunchTemplate(this, "MetabaseLaunchTemplate", {
            launchTemplateData: {
                instanceType: "t4g.medium",
                imageId: new ec2.AmazonLinuxImage({
                    generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
                    cpuType: ec2.AmazonLinuxCpuType.ARM_64,
                }).getImage(this).imageId,
                keyName: "diego-mac-keys", // Clave SSH, cambiala por la tuya
                iamInstanceProfile: {
                    name: new iam.CfnInstanceProfile(this, "InstanceProfile", {
                        roles: [instanceRole.roleName],
                    }).ref,
                },
                securityGroupIds: [instanceSecurityGroup.securityGroupId],
                instanceMarketOptions: {
                    marketType: "spot",
                    spotOptions: {
                        maxPrice: "0.015",
                    },
                },
                userData: cdk.Fn.base64(userDataScript.render()),
            },
        });

        // 6. Crear la Instancia EC2 en una Subred Correcta
        const spotInstance = new ec2.CfnInstance(this, "MetabaseSpotInstance", {
            launchTemplate: {
                launchTemplateId: launchTemplate.ref,
                version: launchTemplate.attrLatestVersionNumber,
            },
            subnetId: subnetId,
        });

        // 7. Salida con la IP Pública
        new cdk.CfnOutput(this, "InstancePublicIP", {
            value: spotInstance.attrPublicIp,
            description: "Dirección IP pública de la instancia Spot",
        });
    }
}
