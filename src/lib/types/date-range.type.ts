import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateScalar } from '../scalars/date.scalar';

@ObjectType()
export class DateRange {
    @Field(() => DateScalar, {
        nullable: true,
    })
    from?: Date;

    @Field(() => DateScalar, {
        nullable: true,
    })
    to?: Date;
}

@InputType()
export class DateRangeInput {
    @Field(() => DateScalar, {
        nullable: true,
    })
    from?: Date;

    @Field(() => DateScalar, {
        nullable: true,
    })
    to?: Date;
}
