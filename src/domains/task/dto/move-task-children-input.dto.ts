import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class MoveTaskChildrenInput {
    @Field(() => String)
    readonly fromParentId: string;

    @Field(() => String)
    readonly toParentId: string;

    @Field(() => String)
    readonly childrenId: string;

    @Field(() => String, {
        nullable: true,
    })
    readonly sortAfterId?: string;
}
