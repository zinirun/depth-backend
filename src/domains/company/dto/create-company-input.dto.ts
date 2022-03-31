import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateCompanyInput {
    @Field()
    readonly name: string;

    @Field()
    readonly email: string;
}
