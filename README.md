# Metabase on AWS CDK

This project deploys Metabase Open Source in a cost-effective way on AWS using CDK (Cloud Development Kit) with TypeScript.

## Architecture

The infrastructure consists of:

- **Compute Layer**: Single EC2 t4g.medium Spot Instance running Metabase
- **Database Layer**: Aurora Serverless v1 PostgreSQL
- **Networking**: VPC with public and private subnets in 2 AZs

### Cost Optimization Features
- Uses ARM-based EC2 Spot instances (t4g.medium) for cost savings
- Aurora Serverless auto-scaling (2-2 ACU) with auto-pause after 10 minutes
- Estimated monthly cost: ~$30-40 USD (may vary by region and usage)

## Prerequisites

- AWS CLI configured
- Node.js >= 14.x
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- SSH key pair in your AWS account named 'diego-mac-keys' (or modify the key name in compute-stack.ts)

## Stack Components

1. **NetworkingStack**: VPC and network infrastructure
2. **DataStack**: Aurora Serverless PostgreSQL database
3. **ComputeStack**: EC2 Spot instance with Metabase

## Deployment

