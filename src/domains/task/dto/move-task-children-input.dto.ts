import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class MoveTaskChildrenInput {
    // if null, fromParent is top depth task
    @Field(() => String, {
        nullable: true,
    })
    readonly fromParentId: string;

    // if null, toParent is top depth task
    @Field(() => String, {
        nullable: true,
    })
    readonly toParentId: string;

    @Field(() => String)
    readonly childrenId: string;

    @Field(() => String, {
        nullable: true,
    })
    readonly sortAfterId?: string;
}
