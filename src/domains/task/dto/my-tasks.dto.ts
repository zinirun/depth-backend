import { Field, ObjectType } from '@nestjs/graphql';
import { Task } from 'src/schemas/task.schema';

@ObjectType()
export class MyTasks {
    @Field(() => [Task])
    today: Task[];

    @Field(() => [Task])
    thisWeek: Task[];

    @Field(() => [Task])
    recent: Task[];
}
