import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GetUser } from 'src/lib/decorators/get-user.decorator';
import { TaskComment } from 'src/schemas/task-comment.schema';
import { Task } from 'src/schemas/task.schema';
import { User } from 'src/schemas/user.schema';
import { CreateTaskCommentInput } from './dto/create-task-comment-input.dto';
import { CreateTaskInput } from './dto/create-task-input.dto';
import { MoveTaskChildInput } from './dto/move-task-child-input.dto';
import { MyTasks } from './dto/my-tasks.dto';
import { UpdateTaskCommentInput } from './dto/update-task-comment-input.dto';
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

    @Query(() => [Task], {
        name: 'tasksByProjectId',
    })
    async getAllByProjectId(
        @GetUser() user: User,
        @Args('projectId', { type: () => ID }) projectId: string,
    ): Promise<Task[]> {
        return await this.taskService.getAllByProjectIdAndUserId(projectId, user._id);
    }

    @Query(() => MyTasks, {
        name: 'myTasks',
    })
    async getAllInvolvedByDate(@GetUser() user: User): Promise<MyTasks> {
        return await this.taskService.getAllInvolvedByDateAndUserId(user._id);
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

    @Mutation(() => TaskComment, {
        name: 'createTaskComment',
    })
    async createComment(
        @GetUser() user: User,
        @Args('comment', { type: () => CreateTaskCommentInput }) input: CreateTaskCommentInput,
    ): Promise<TaskComment> {
        return await this.taskService.createComment(input, user);
    }

    @Mutation(() => TaskComment, {
        name: 'updateTaskComment',
    })
    async updateComment(
        @GetUser() user: User,
        @Args('comment', { type: () => UpdateTaskCommentInput }) input: UpdateTaskCommentInput,
    ): Promise<TaskComment> {
        return await this.taskService.updateComment(input, user);
    }

    @Mutation(() => ID, {
        name: 'deleteTaskComment',
    })
    async deleteComment(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
    ): Promise<string> {
        return await this.taskService.removeComment(id, user._id);
    }

    @Mutation(() => [Task], {
        name: 'moveTaskChild',
    })
    async moveChild(
        @GetUser() user: User,
        @Args('input', { type: () => MoveTaskChildInput }) input: MoveTaskChildInput,
    ): Promise<[Task, Task?]> {
        return await this.taskService.moveChild(user, input);
    }
}
