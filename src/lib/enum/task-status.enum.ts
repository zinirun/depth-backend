import { registerEnumType } from '@nestjs/graphql';

export enum TaskStatus {
    Ready = 'READY',
    OnGoing = 'ON_GOING',
    Done = 'DONE',
}

registerEnumType(TaskStatus, { name: 'TaskStatus' });
