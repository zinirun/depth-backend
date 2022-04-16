import { registerEnumType } from '@nestjs/graphql';

export enum UserAuthType {
    Plain = 'PLAIN',
    Google = 'GOOGLE',
}

registerEnumType(UserAuthType, { name: 'UserAuthType' });
