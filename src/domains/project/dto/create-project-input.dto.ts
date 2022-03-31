import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateProjectInput {
    @Field()
    readonly title: string;

    @Field(() => [ID])
    accesses: string[];
}
