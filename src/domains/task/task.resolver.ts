import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GetUser } from 'src/lib/decorators/get-user.decorator';
import { Task } from 'src/schemas/task.schema';
import { User } from 'src/schemas/user.schema';
import { CreateTaskInput } from './dto/create-task-input.dto';
import { MoveTaskChildrenInput } from './dto/move-task-children-input.dto';
import { TaskMeta } from './dto/task-meta.dto';
import { UpdateTaskInput } from './dto/update-task-input.dto';
import { TaskService } from './task.service';

@Resolver()
export class TaskResolver {
    constructor(private readonly taskService: TaskService) {}

    @Mutation(() => Task, {
        name: 'createTask',
    })
    async createOne(
        @GetUser() user: User,
        @Args('task', { type: () => CreateTaskInput }) task: CreateTaskInput,
    ): Promise<Task> {
        return await this.taskService.create(task, user);
    }

    @Query(() => Task, {
        name: 'task',
    })
    async getOne(@GetUser() user: User, @Args('id', { type: () => ID }) id: string): Promise<Task> {
        return await this.taskService.getOneAndCheckAccessOrThrowById(id, user._id);
    }

    @Query(() => [TaskMeta], {
        name: 'tasksByProjectId',
    })
    async getAllMetaByProjectId(
        @GetUser() user: User,
        @Args('projectId', { type: () => ID }) projectId: string,
    ): Promise<TaskMeta[]> {
        return await this.taskService.getAllMetaByProjectIdAndUserId(projectId, user._id);
    }

    @Mutation(() => Task, {
        name: 'updateTask',
    })
    async updateOne(
        @GetUser() user: User,
        @Args('task', { type: () => UpdateTaskInput }) task: UpdateTaskInput,
    ): Promise<Task> {
        return await this.taskService.update(task, user);
    }

    @Mutation(() => ID, {
        name: 'deleteTask',
    })
    async delete(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
    ): Promise<string> {
        return await this.taskService.remove(id, user._id);
    }

    @Mutation(() => ID, {
        name: 'restoreTask',
    })
    async restore(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
    ): Promise<string> {
        return await this.taskService.restore(id, user._id);
    }

    @Mutation(() => [Task], {
        name: 'moveTaskChildren',
    })
    async moveChildren(
        @GetUser() user: User,
        @Args('input', { type: () => MoveTaskChildrenInput }) input: MoveTaskChildrenInput,
    ): Promise<[Task, Task]> {
        return await this.taskService.moveChildren(user, input);
    }
}
