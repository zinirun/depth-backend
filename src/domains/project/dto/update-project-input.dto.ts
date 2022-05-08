import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateProjectInput {
    @Field()
    readonly id: string;

    @Field()
    readonly title: string;

    @Field(() => [ID])
    readonly accesses: string[];
}
