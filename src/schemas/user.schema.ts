import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Document } from 'mongoose';
import { softDeletePlugin } from 'src/lib/plugins/soft-delete.plugin';
import { UserRole } from 'src/lib/enum/user-role.enum';
import { DateScalar } from 'src/lib/scalars/date.scalar';
import { Schemas } from './@define';
import { Company } from './company.schema';
import { UserAuthType } from 'src/lib/enum/user-auth-type.enum';
import { UserInviteStatus } from 'src/lib/enum/user-invite-status.enum';

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
        required: true,
        default: UserAuthType.Plain,
        enum: Object.values(UserAuthType),
    })
    @Field(() => UserAuthType)
    authType: UserAuthType;

    @Prop()
    @Field({
        nullable: true,
    })
    oauthProvider?: string;

    @Prop()
    @Field({
        nullable: true,
    })
    oauthId?: string;

    @Prop({
        index: true,
        required: true,
        trim: true,
        unique: true,
    })
    @Field()
    email: string;

    // doesn't need in oauth type
    @Prop()
    password?: string;

    @Prop({
        trim: true,
        nullable: true,
    })
    @Field({
        nullable: true,
    })
    name?: string;

    @Prop({
        required: true,
        default: UserRole.Common,
        enum: Object.values(UserRole),
    })
    @Field(() => UserRole)
    role: UserRole;

    @Prop({
        required: true,
        default: UserInviteStatus.Pending,
        enum: Object.values(UserInviteStatus),
    })
    @Field(() => UserInviteStatus)
    inviteStatus: UserInviteStatus;

    @Field(() => DateScalar)
    createdAt: Date;

    @Field(() => DateScalar)
    updatedAt: Date;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User).plugin(softDeletePlugin);
