import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AssignPlainUserInput {
    @Field()
    readonly name: string;

    @Field()
    readonly password: string;
}
