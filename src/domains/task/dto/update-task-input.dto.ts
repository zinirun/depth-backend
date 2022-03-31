import { Field, ID, InputType } from '@nestjs/graphql';
import { TaskStatus } from 'src/lib/enum/task-status.enum';
import { DateRangeInput } from 'src/lib/types/date-range.type';

@InputType()
export class UpdateTaskInput {
    @Field(() => ID)
    readonly id: string;

    @Field(() => String, {
        nullable: true,
    })
    readonly title?: string;

    @Field(() => String, {
        nullable: true,
    })
    readonly content?: string;

    @Field(() => DateRangeInput, {
        nullable: true,
    })
    readonly deadline?: DateRangeInput;

    @Field(() => [String], {
        nullable: 'itemsAndList',
    })
    readonly involvedUserIds?: string[];

    @Field(() => TaskStatus, {
        nullable: true,
    })
    readonly status?: TaskStatus;
}
