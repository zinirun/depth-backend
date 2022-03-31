import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskComment, TaskCommentSchema } from 'src/schemas/task-comment.schema';
import { Task, TaskSchema } from 'src/schemas/task.schema';
import { ProjectModule } from '../project/project.module';
import { TaskResolver } from './task.resolver';
import { TaskService } from './task.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Task.name,
                schema: TaskSchema,
            },
            {
                name: TaskComment.name,
                schema: TaskCommentSchema,
            },
        ]),
        ProjectModule,
    ],
    providers: [TaskResolver, TaskService],
    exports: [TaskService],
})
export class TaskModule {}
