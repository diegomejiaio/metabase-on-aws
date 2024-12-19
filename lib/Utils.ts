import { Stack } from "aws-cdk-lib";
import * as crypto from 'crypto';

export function getSuffixFromStack(stack: Stack): string {
    const stackName = stack.stackName;
    const hash = crypto.createHash('sha256').update(stackName).digest('hex');
    return hash.slice(0, 8); // Use the first 8 characters of the hash as the suffix
}