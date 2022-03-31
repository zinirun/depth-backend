import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
    Common = 'COMMON',
    Manager = 'MANAGER',
    Admin = 'ADMIN',
}

registerEnumType(UserRole, { name: 'UserRole' });
