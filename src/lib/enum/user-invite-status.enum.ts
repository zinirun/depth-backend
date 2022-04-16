import { registerEnumType } from '@nestjs/graphql';

export enum UserInviteStatus {
    Pending = 'PENDING',
    Assigned = 'ASSIGNED',
}

registerEnumType(UserInviteStatus, { name: 'UserInviteStatus' });
