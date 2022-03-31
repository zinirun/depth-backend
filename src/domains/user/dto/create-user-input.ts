import { Field, ID, InputType } from '@nestjs/graphql';
import { UserRole } from 'src/lib/enum/user-role.enum';

@InputType()
export class CreateUserInput {
    @Field(() => ID)
    readonly companyId: string;

    @Field()
    readonly email: string;

    @Field()
    readonly password: string;

    @Field()
    readonly name: string;

    @Field(() => UserRole)
    readonly role: UserRole;
}
