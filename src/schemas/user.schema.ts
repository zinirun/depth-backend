import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Document } from 'mongoose';
import { softDeletePlugin } from 'src/lib/plugins/soft-delete.plugin';
import { UserRole } from 'src/lib/enum/user-role.enum';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { Schemas } from './@define';
import { Company } from './company.schema';

@Schema({
    collection: Schemas.User.name,
    timestamps: true,
})
@ObjectType()
export class User {
    @Field(() => ID)
    _id: string;

    @Field(() => ID, {
        nullable: true,
    })
    _access?: string;

    @Prop({
        type: mongoose.Schema.Types.ObjectId,
        ref: Schemas.Company.name,
        required: true,
    })
    @Field(() => Company)
    company: Company;

    @Prop({
        index: true,
        required: true,
        trim: true,
        unique: true,
    })
    @Field()
    email: string;

    @Prop({
        required: true,
    })
    password: string;

    @Prop({
        required: true,
        trim: true,
    })
    @Field()
    name: string;

    @Prop({
        required: true,
        default: UserRole.Common,
        enum: Object.values(UserRole),
    })
    @Field(() => UserRole)
    role: UserRole;

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => DateScalar)
    updatedAt: Date;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User).plugin(softDeletePlugin);
