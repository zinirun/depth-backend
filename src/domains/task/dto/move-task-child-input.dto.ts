import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class MoveTaskChildInput {
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
    readonly childId: string;

    @Field(() => Int, {
        nullable: true,
    })
    readonly sortIndex?: number;
}
