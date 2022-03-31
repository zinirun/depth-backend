import { Field, ID, ObjectType } from '@nestjs/graphql';
import { LeanDocument } from 'mongoose';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { DateRange } from 'src/lib/types/date-range.type';
import { TaskComment } from 'src/schemas/task-comment.schema';
import { User } from 'src/schemas/user.schema';

@ObjectType()
export class TaskMeta {
    @Field(() => ID)
    _id: string;

    @Field(() => User)
    author: User;

    @Field()
    title: string;

    @Field({
        nullable: true,
    })
    content?: string;

    @Field(() => Boolean)
    isTopDepth: boolean;

    @Field(() => [TaskMeta])
    childrens: TaskMeta[];

    @Field(() => [User])
    involvedUsers: User[];

    @Field(() => [ID])
    comments: LeanDocument<TaskComment>[];

    @Field(() => DateRange, {
        nullable: true,
    })
    deadline?: DateRange;

    @Field(() => DateScalar)
    createdAt: Date;
}
