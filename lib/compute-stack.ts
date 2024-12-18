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
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerServiceforEC2Role'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'), // Acceso a SSM
            ],
        });

        // 3. Launch Template para la instancia Spot
        const launchTemplate = new ec2.CfnLaunchTemplate(this, 'MetabaseLaunchTemplate', {
            launchTemplateData: {
                instanceType: 't4g.medium',
                imageId: new ec2.AmazonLinuxImage({
                    generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
                    cpuType: ec2.AmazonLinuxCpuType.ARM_64,
                }).getImage(this).imageId,
                keyName: 'diego-mac-keys', // Par de claves SSH
                iamInstanceProfile: {
                    name: new iam.CfnInstanceProfile(this, 'InstanceProfile', {
                        roles: [instanceRole.roleName],
                    }).ref,
                },
                securityGroupIds: [instanceSecurityGroup.securityGroupId],
                instanceMarketOptions: {
                    marketType: 'spot',
                    spotOptions: {
                        maxPrice: '0.015', // Precio máximo para Spot Instances
                    },
                },
            },
        });

        // 4. Crear la instancia EC2 Spot a partir del Launch Template
        const spotInstance = new ec2.CfnInstance(this, 'MetabaseSpotInstance', {
            launchTemplate: {
                launchTemplateId: launchTemplate.ref,
                version: launchTemplate.attrLatestVersionNumber,
            },
        });

        // 5. Permitir conexiones a Aurora Serverless desde la instancia EC2
        props.dbCluster.connections.allowDefaultPortFrom(
            ec2.Peer.ipv4(spotInstance.attrPublicIp), 'Permitir acceso a Aurora desde la instancia Spot'
        );

        // 6. Salida con la IP pública de la instancia Spot
        new cdk.CfnOutput(this, 'InstancePublicIP', {
            value: spotInstance.attrPublicIp,
            description: 'Dirección IP pública de la instancia Spot',
        });
    }
}
