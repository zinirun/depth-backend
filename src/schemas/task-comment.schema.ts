import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { deepNestedPlugin } from 'src/lib/plugins/deep-nested.plugin';
import { softDeletePlugin } from 'src/lib/plugins/soft-delete.plugin';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { Schemas } from './@define';
import { User } from './user.schema';

@Schema({
    collection: Schemas.TaskComment.name,
    timestamps: true,
})
@ObjectType()
export class TaskComment {
    @Field(() => ID)
    _id: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Schemas.User.name, required: true })
    @Field(() => User)
    author: User;

    @Prop({
        required: true,
        trim: true,
    })
    @Field(() => String)
    content: string;

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => DateScalar)
    updatedAt: Date;
}

export type TaskCommentDocument = TaskComment & Document;
export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment)
    .plugin(softDeletePlugin)
    .plugin((schema) =>
        deepNestedPlugin(schema, [
            {
                path: 'author',
            },
        ]),
    );
