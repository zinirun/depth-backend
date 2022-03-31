import { Field, ID, InputType } from '@nestjs/graphql';
import { DateRangeInput } from 'src/lib/types/date-range.type';

@InputType()
export class CreateTaskInput {
    @Field(() => ID)
    readonly projectId: string;

    // if null: top depth, if not null: sub depth
    @Field(() => ID, {
        nullable: true,
    })
    readonly parentTaskId?: string;

    @Field(() => ID, {
        nullable: true,
    })
    readonly sortAfterTaskId?: string;

    @Field(() => String)
    readonly title: string;

    @Field(() => String, {
        nullable: true,
    })
    readonly content?: string;

    @Field(() => DateRangeInput, {
        nullable: true,
    })
    readonly deadline?: DateRangeInput;

    @Field(() => [String], {
        nullable: true,
    })
    readonly involvedUserIds: string[];
}
