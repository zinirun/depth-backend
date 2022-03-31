import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DateScalar } from '../scalars/date.scalar';

// type DataTrailKeyType =
//     | 'createdAt'
//     | 'createdBy'
//     | 'updatedAt'
//     | 'updatedBy'
//     | 'deletedBy'
//     | 'deletedAt';
// type DataTrailValueType = Date | string | undefined;
// export type DataTrail = Record<DataTrailKeyType, DataTrailValueType>;

enum TrailKind {
    CreateBySystem = 'CREATE_BY_SYSTEM',
    CreateByUser = 'CREATE_BY_USER',
    UpdateBySystem = 'UPDATE_BY_SYSTEM',
    UpdateByUser = 'UPDATE_BY_USER',
    DeleteBySystem = 'DELETE_BY_SYSTEM',
    DeleteByUser = 'DELETE_BY_USER',
}
// export type TrailKind = 'CREATE' | 'UPDATE' | 'DELETE'

@ObjectType()
export class Trail {
    @Field(() => ID, {
        nullable: true,
    })
    deletedBy?: string;

    @Field(() => DateScalar, {
        nullable: true,
    })
    deletedAt?: Date;

    @Field(() => ID, {
        nullable: true,
    })
    createdBy?: string;

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => ID, {
        nullable: true,
    })
    updatedBy?: string;

    @Field(() => DateScalar)
    updatedAt: Date;

    constructor(kind: TrailKind) {
        if (kind === TrailKind.CreateBySystem) {
            this.createdAt = new Date();
            this.updatedAt = new Date();
        }
        if (kind === TrailKind.CreateByUser) {
            this.createdAt = new Date();
            this.updatedAt = new Date();
        }
    }
}
