import { SetMetadata } from '@nestjs/common';

export const SYSTEM_AUTH = 'systemAuth';
export const SystemAuth = () => SetMetadata(SYSTEM_AUTH, true);
