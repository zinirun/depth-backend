import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { Schemas } from './@define';
import { User } from './user.schema';
import { softDeletePlugin } from 'src/lib/plugins/soft-delete.plugin';

@Schema({
    collection: Schemas.Company.name,
    timestamps: true,
})
@ObjectType()
export class Company {
    @Field(() => ID)
    _id: string;

    @Prop({
        required: true,
        trim: true,
    })
    @Field()
    name: string;

    @Prop({
        required: true,
        trim: true,
    })
    @Field()
    email: string;

    @Prop({
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: Schemas.User.name }],
    })
    @Field(() => [User])
    users: User[];

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => DateScalar)
    updatedAt: Date;
}

export type CompanyDocument = Company & Document;
export const CompanySchema = SchemaFactory.createForClass(Company).plugin(softDeletePlugin);
