import { Field, ID, InputType } from '@nestjs/graphql';
import { UserAuthType } from 'src/lib/enum/user-auth-type.enum';
import { UserRole } from 'src/lib/enum/user-role.enum';

@InputType()
export class CreateUserInput {
    @Field()
    readonly email: string;

    @Field(() => UserRole)
    readonly role: UserRole;
}

@InputType()
export class OAuthInput {
    @Field()
    readonly email: string;

    @Field()
    readonly name: string;

    @Field()
    readonly oauthProvider: string;

    @Field()
    readonly oauthId: string;

    @Field()
    readonly authType: UserAuthType;
}
