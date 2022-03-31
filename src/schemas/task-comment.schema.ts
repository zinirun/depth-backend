import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { softDeletePlugin } from 'src/lib/plugins/soft-delete.plugin';
import { Schemas } from './@define';
import { User } from './user.schema';

@Schema({
    collection: Schemas.TaskComment.name,
    timestamps: true,
})
@ObjectType()
export class TaskComment {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Schemas.User.name, required: true })
    @Field(() => User)
    author: User;

    @Prop({
        required: true,
        trim: true,
    })
    @Field(() => String)
    content: string;
}

export type TaskCommentDocument = TaskComment & Document;
export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment).plugin(softDeletePlugin);
