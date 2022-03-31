import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { softDeletePlugin } from 'src/lib/plugins/soft-delete.plugin';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { Schemas } from './@define';
import { Company } from './company.schema';
import { User } from './user.schema';

@Schema({
    collection: Schemas.Project.name,
    timestamps: true,
})
@ObjectType()
export class Project {
    @Field(() => ID)
    _id: string;

    @Prop({
        type: mongoose.Schema.Types.ObjectId,
        ref: Schemas.Company.name,
    })
    @Field(() => Company)
    company: Company;

    @Prop({
        required: true,
        trim: true,
    })
    @Field()
    title: string;

    @Prop({
        type: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: Schemas.User.name,
                index: {
                    unique: true,
                    dropDups: true,
                },
            },
        ],
    })
    @Field(() => [User])
    accesses: User[];

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Schemas.User.name })
    @Field(() => User)
    manager: User;

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => DateScalar)
    updatedAt: Date;
}

export type ProjectDocument = Project & Document;
export const ProjectSchema = SchemaFactory.createForClass(Project).plugin(softDeletePlugin);