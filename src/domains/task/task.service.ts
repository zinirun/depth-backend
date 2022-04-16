import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { User } from 'src/schemas/user.schema';
import { SoftDeleteModel } from 'src/lib/plugins/soft-delete.plugin';
import { Task, TaskDocument } from 'src/schemas/task.schema';
import { CreateTaskInput } from './dto/create-task-input.dto';
import { ProjectService } from '../project/project.service';
import { TaskMeta } from './dto/task-meta.dto';
import { UpdateTaskInput } from './dto/update-task-input.dto';
import { ClientSession } from 'mongoose';
import { MoveTaskChildrenInput } from './dto/move-task-children-input.dto';
import { TaskComment, TaskCommentDocument } from 'src/schemas/task-comment.schema';
import { CreateTaskCommentInput } from './dto/create-task-comment-input.dto';
import { UpdateTaskCommentInput } from './dto/update-task-comment-input.dto';

@Injectable()
export class TaskService {
    constructor(
        @InjectConnection() private connection: Connection,
        @InjectModel(Task.name) private taskModel: SoftDeleteModel<TaskDocument>,
        @InjectModel(TaskComment.name)
        private taskCommentModel: SoftDeleteModel<TaskCommentDocument>,
        private readonly projectService: ProjectService,
    ) {}

    async create(input: CreateTaskInput, user: User): Promise<Task> {
        const {
            projectId,
            parentTaskId,
            sortAfterTaskId,
            involvedUserIds: involvedUsers,
            ...taskInput
        } = input;
        await this.projectService.getOneAndCheckAccessOrThrowById(projectId, user._id);

        const newTask = new this.taskModel({
            ...taskInput,
            project: projectId,
            author: user._id,
            isTopDepth: !parentTaskId,
            involvedUsers,
        });

        if (parentTaskId) {
            const session = await this.connection.startSession();
            session.startTransaction();
            try {
                const { _id } = await newTask.save({ session });
                await this.addChildren(parentTaskId, _id, sortAfterTaskId, session);
                await session.commitTransaction();

                await this.projectService.updateTaskUpdatedAt(projectId);
                return await this.getOneOrThrowById(_id);
            } catch (err) {
                console.error(err);
                session.abortTransaction();
                throw new InternalServerErrorException('Transaction aborted');
            } finally {
                session.endSession();
            }
        } else {
            const { _id } = await newTask.save();
            return await this.getOneOrThrowById(_id);
        }
    }

    async getOneOrThrowById(id: string): Promise<Task> {
        const task = await this.taskModel
            .findById(id)
            .populate('author')
            .populate('project')
            .populate('childrens')
            .populate('involvedUsers')
            .populate('comments')
            .populate('comments.author')
            .lean()
            .exec();
        if (!task) {
            throw new NotFoundException('Task not exists');
        }
        return task;
    }

    async getOneAndCheckAccessOrThrowById(id: string, userId: string): Promise<Task> {
        const task = await this.taskModel
            .findById(id)
            .populate('author')
            .populate('project')
            .populate('childrens')
            .populate('involvedUsers')
            .populate('comments')
            .populate('comments.author')
            .lean()
            .exec();
        if (
            !task ||
            !(await this.projectService.getOneAndCheckAccessOrThrowById(task.project._id, userId))
        ) {
            throw new NotFoundException('Task not exists');
        }
        return task;
    }

    async getAllMetaByProjectIdAndUserId(projectId: string, userId: string): Promise<TaskMeta[]> {
        await this.projectService.getOneAndCheckAccessOrThrowById(projectId, userId);
        const tasks = await this.taskModel
            .find({
                project: projectId,
                isTopDepth: true,
            })
            .populate('author')
            .populate('project')
            .populate('childrens')
            .populate('involvedUsers')
            .lean()
            .exec();
        return tasks;
    }

    async update(input: UpdateTaskInput, user: User): Promise<Task> {
        const { id, ...taskInput } = input;
        const task = await this.getOneOrThrowById(id);
        await this.projectService.getOneAndCheckAccessOrThrowById(task.project._id, user._id);

        let $set: Record<string, any> = {};

        const { title, content, deadline, involvedUserIds, status } = taskInput;

        if (title) {
            $set.title = title;
        }
        if (content) {
            $set.content = content;
        }
        if (deadline) {
            $set.deadline = deadline;
        }
        if (involvedUserIds) {
            $set.involvedUsers = involvedUserIds;
        }
        if (status) {
            $set.status = status;
        }

        await this.taskModel
            .updateOne(
                {
                    _id: id,
                },
                {
                    $set,
                },
            )
            .exec();
        await this.projectService.updateTaskUpdatedAt(task.project._id);
        return await this.getOneOrThrowById(id);
    }

    async remove(id: string, requesterId: string): Promise<string> {
        const task = await this.getOneOrThrowById(id);
        this.throwIfIsNotAuthor(task, requesterId);
        await this.taskModel.softDelete({
            _id: id,
        });
        return id;
    }

    async restore(id: string, requesterId: string): Promise<string> {
        const task = await this.taskModel.findDeletedById(id);
        this.throwIfIsNotAuthor(task, requesterId);
        await this.taskModel.restore({
            _id: id,
        });
        return id;
    }

    async createComment(input: CreateTaskCommentInput, user: User): Promise<TaskComment> {
        const { taskId, content } = input;
        const task = await this.getOneOrThrowById(taskId);
        await this.projectService.getOneAndCheckAccessOrThrowById(task.project._id, user._id);

        const newComment = new this.taskCommentModel({
            author: user._id,
            content,
        });

        const session = await this.connection.startSession();
        session.startTransaction();
        try {
            const { _id: newCommentId } = await newComment.save({ session });
            await this.taskModel
                .updateOne(
                    {
                        _id: task._id,
                    },
                    {
                        $set: {
                            comments: { ...task.comments, newCommentId },
                        },
                    },
                )
                .session(session)
                .exec();
            await session.commitTransaction();
            return await this.getOneCommentOrThrowById(newCommentId);
        } catch (err) {
            console.error(err);
            session.abortTransaction();
            throw new InternalServerErrorException('Transaction aborted');
        } finally {
            session.endSession();
        }
    }

    async getOneCommentOrThrowById(id: string): Promise<TaskComment> {
        const comment = await this.taskCommentModel.findById(id).populate('author').lean().exec();
        if (!comment) {
            throw new NotFoundException('Comment not exists');
        }
        return comment;
    }

    async updateComment(input: UpdateTaskCommentInput, user: User): Promise<TaskComment> {
        const { id, content } = input;
        const comment = await this.getOneCommentOrThrowById(id);
        this.throwIfIsNotAuthor(comment, user._id);

        await this.taskCommentModel
            .updateOne(
                {
                    _id: id,
                },
                {
                    $set: {
                        content,
                    },
                },
            )
            .exec();

        return await this.getOneCommentOrThrowById(id);
    }

    async removeComment(id: string, requesterId: string): Promise<string> {
        const comment = await this.getOneCommentOrThrowById(id);
        this.throwIfIsNotAuthor(comment, requesterId);
        await this.taskCommentModel.softDelete({
            _id: id,
        });
        return id;
    }

    async restoreComment(id: string, requesterId: string): Promise<string> {
        const comment = await this.taskCommentModel.findDeletedById(id);
        this.throwIfIsNotAuthor(comment, requesterId);
        await this.taskCommentModel.restore({
            _id: id,
        });
        return id;
    }

    async addChildren(
        parentId: string,
        childrenId: string,
        sortAfterId?: string,
        session?: ClientSession,
    ): Promise<Task> {
        const parent = await this.getOneOrThrowById(parentId);

        let childrens = [...parent.childrens, childrenId];

        if (sortAfterId) {
            const sortAfterIndex = parent.childrens.findIndex(
                (children) => String(children._id) === sortAfterId,
            );
            if (sortAfterIndex !== -1) {
                childrens = [
                    ...parent.childrens.slice(0, sortAfterIndex + 1),
                    childrenId,
                    ...parent.childrens.slice(sortAfterIndex + 1),
                ];
            } else {
                throw new BadRequestException('Sorting task not exists');
            }
        }

        await this.taskModel
            .updateOne(
                {
                    _id: parentId,
                },
                {
                    $set: {
                        childrens,
                    },
                },
            )
            .session(session || undefined)
            .exec();
        return await this.getOneOrThrowById(parentId);
    }

    async removeChildren(parentId: string, childrenId: string): Promise<Task> {
        const parent = await this.getOneOrThrowById(parentId);

        await this.taskModel
            .updateOne(
                {
                    _id: parentId,
                },
                {
                    $set: {
                        childrens: parent.childrens.filter(
                            (children) => String(children._id) !== String(childrenId),
                        ),
                    },
                },
            )
            .exec();
        return await this.getOneOrThrowById(parentId);
    }

    async moveChildren(
        user: User,
        { fromParentId, toParentId, childrenId, sortAfterId }: MoveTaskChildrenInput,
    ): Promise<[Task, Task?]> {
        const fromParent = await this.getOneOrThrowById(fromParentId);
        await this.projectService.getOneAndCheckAccessOrThrowById(fromParent.project._id, user._id);

        if (fromParentId === toParentId) {
            // move in same parent - just update sorting
            if (sortAfterId) {
                const sortAfterIndex = fromParent.childrens.findIndex(
                    (children) => String(children._id) === sortAfterId,
                );
                if (sortAfterIndex !== -1) {
                    const childrens = [
                        ...fromParent.childrens.slice(0, sortAfterIndex + 1),
                        childrenId,
                        ...fromParent.childrens.slice(sortAfterIndex + 1),
                    ];
                    await this.taskModel
                        .updateOne(
                            {
                                _id: fromParentId,
                            },
                            {
                                $set: {
                                    childrens,
                                },
                            },
                        )
                        .exec();
                } else {
                    throw new BadRequestException('Sorting task not exists');
                }
            }
            return [await this.getOneOrThrowById(fromParentId)];
        } else {
            // move to another parent
            const toParent = await this.getOneOrThrowById(toParentId);

            await this.projectService.getOneAndCheckAccessOrThrowById(
                toParent.project._id,
                user._id,
            );

            const fromChildrens = fromParent.childrens.filter(
                (children) => String(children._id) !== String(childrenId),
            );
            let toChildrens = [...toParent.childrens, childrenId];

            if (sortAfterId) {
                const sortAfterIndex = toParent.childrens.findIndex(
                    (children) => String(children._id) === sortAfterId,
                );
                if (sortAfterIndex !== -1) {
                    toChildrens = [
                        ...toParent.childrens.slice(0, sortAfterIndex + 1),
                        childrenId,
                        ...toParent.childrens.slice(sortAfterIndex + 1),
                    ];
                } else {
                    throw new BadRequestException('Sorting task not exists');
                }
            }

            const session = await this.connection.startSession();
            session.startTransaction();
            try {
                await this.taskModel
                    .updateOne(
                        {
                            _id: fromParentId,
                        },
                        {
                            $set: {
                                childrens: fromChildrens,
                            },
                        },
                    )
                    .session(session)
                    .exec();
                await this.taskModel
                    .updateOne(
                        {
                            _id: toParentId,
                        },
                        {
                            $set: {
                                childrens: toChildrens,
                            },
                        },
                    )
                    .session(session)
                    .exec();
                await session.commitTransaction();
                return [
                    await this.getOneOrThrowById(fromParentId),
                    await this.getOneOrThrowById(toParentId),
                ];
            } catch (err) {
                console.error(err);
                session.abortTransaction();
                throw new InternalServerErrorException('Transaction aborted');
            } finally {
                session.endSession();
            }
        }
    }

    throwIfIsNotAuthor(task: Task | TaskComment, userId: string): void {
        if (!(String(task.author._id) === String(userId))) {
            throw new NotFoundException('Cannot access');
        }
    }
}
