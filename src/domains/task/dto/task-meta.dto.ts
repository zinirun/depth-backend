import { Field, ID, ObjectType } from '@nestjs/graphql';
import { LeanDocument } from 'mongoose';
import { TaskStatus } from 'src/lib/enum/task-status.enum';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { DateRange } from 'src/lib/types/date-range.type';
import { Project } from 'src/schemas/project.schema';
import { TaskComment } from 'src/schemas/task-comment.schema';
import { User } from 'src/schemas/user.schema';

@ObjectType()
export class TaskMeta {
    @Field(() => ID)
    _id: string;

    @Field(() => User)
    author: User;

    @Field({
        nullable: true,
    })
    title?: string;

    @Field({
        nullable: true,
    })
    content?: string;

    @Field(() => Project)
    project?: Project;

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

    @Field(() => TaskStatus, {
        nullable: true,
    })
    status?: TaskStatus;

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => DateScalar)
    updatedAt: Date;
}
