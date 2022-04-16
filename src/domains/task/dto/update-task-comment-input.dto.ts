import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateTaskCommentInput {
    @Field(() => ID)
    id: string;

    @Field()
    content: string;
}
