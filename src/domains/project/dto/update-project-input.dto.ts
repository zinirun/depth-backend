import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateProjectInput {
    @Field()
    readonly id: string;

    @Field()
    readonly title: string;
}
