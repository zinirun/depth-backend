import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateTaskCommentInput {
    @Field(() => ID)
    taskId: string;

    @Field()
    content: string;
}
