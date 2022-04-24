import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { deepNestedPlugin } from 'src/lib/plugins/deep-nested.plugin';
import { softDeletePlugin } from 'src/lib/plugins/soft-delete.plugin';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { DateRange } from 'src/lib/types/date-range.type';
import { TaskStatus } from 'src/lib/enum/task-status.enum';
import { RawTypes, Schemas } from './@define';
import { Project } from './project.schema';
import { TaskComment } from './task-comment.schema';
import { User } from './user.schema';

@Schema({
    collection: Schemas.Task.name,
    timestamps: true,
})
@ObjectType()
export class Task {
    @Field(() => ID)
    _id: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Schemas.User.name, required: true })
    @Field(() => User)
    author: User;

    @Prop({
        trim: true,
    })
    @Field({
        nullable: true,
    })
    title?: string;

    @Prop()
    @Field({
        nullable: true,
    })
    content?: string;

    @Prop({
        type: mongoose.Schema.Types.ObjectId,
        ref: Schemas.Project.name,
        required: true,
    })
    @Field(() => Project)
    project: Project;

    @Prop({
        default: false,
    })
    @Field(() => Boolean)
    isTopDepth: boolean;

    @Prop({
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: Schemas.Task.name }],
    })
    @Field(() => [Task])
    childrens: Task[];

    @Prop({
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: Schemas.User.name }],
    })
    @Field(() => [User])
    involvedUsers: User[];

    @Prop({
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: Schemas.TaskComment.name }],
    })
    @Field(() => [TaskComment])
    comments: TaskComment[];

    @Prop(raw(RawTypes.DateRange))
    @Field(() => DateRange, {
        nullable: true,
    })
    deadline?: DateRange;

    @Prop({
        enum: Object.values(TaskStatus),
    })
    @Field(() => TaskStatus, {
        nullable: true,
    })
    status?: TaskStatus;

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => DateScalar)
    updatedAt: Date;
}

export type TaskDocument = Task & Document;
export const TaskSchema = SchemaFactory.createForClass(Task)
    .plugin(softDeletePlugin)
    .plugin((schema) =>
        deepNestedPlugin(schema, [
            {
                path: 'childrens',
                populate: [
                    {
                        path: 'author',
                    },
                    {
                        path: 'involvedUsers',
                    },
                    {
                        path: 'project',
                    },
                    {
                        path: 'comments',
                    },
                ],
            },
        ]),
    );
