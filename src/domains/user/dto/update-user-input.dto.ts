import { Field, ID, InputType } from '@nestjs/graphql';
import { UserRole } from 'src/lib/enum/user-role.enum';

@InputType()
export class UpdateUserInput {
    @Field(() => ID)
    readonly id: string;

    @Field({ nullable: true })
    readonly name?: string;

    @Field(() => UserRole, { nullable: true })
    readonly role?: UserRole;
}
