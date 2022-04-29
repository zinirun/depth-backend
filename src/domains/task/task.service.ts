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
        const project = await this.projectService.getOneAndCheckAccessOrThrowById(
            projectId,
            user._id,
        );

        const newTask = new this.taskModel({
            ...taskInput,
            project: projectId,
            author: user._id,
            isTopDepth: !parentTaskId,
            involvedUsers,
        });

        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            if (parentTaskId) {
                // task level; sub task (not top depth)
                const { _id } = await newTask.save({ session });
                await this.addChild(parentTaskId, _id, sortAfterTaskId, session);

                await session.commitTransaction();
                await this.projectService.updateTaskUpdatedAt(projectId);
                return await this.getOneOrThrowById(_id);
            } else {
                // project level; task (top depth)
                const { _id } = await newTask.save({ session });
                await this.projectService.addTopChild(project, _id, sortAfterTaskId, session);

                await session.commitTransaction();
                await this.projectService.updateTaskUpdatedAt(projectId);
                return await this.getOneOrThrowById(_id);
            }
        } catch (err) {
            console.error(err);
            session.abortTransaction();
            throw new InternalServerErrorException('Transaction aborted');
        } finally {
            session.endSession();
        }
    }

    async getOneOrThrowById(id: string): Promise<Task> {
        const task = await this.taskModel
            .findById(id)
            .populate('author')
            .populate('project')
            .populate('children')
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
            .populate('children')
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

    async getAllByProjectIdAndUserId(projectId: string, userId: string): Promise<Task[]> {
        const project = await this.projectService.getOneAndCheckAccessOrThrowById(
            projectId,
            userId,
        );
        const tasks = await this.taskModel
            .find({
                _id: {
                    $in: project.topChildren,
                },
                // migrated task -> project based nested children
                // project: projectId,
                // isTopDepth: true,
            })
            .populate('author')
            .populate('project')
            .populate('children')
            .populate('involvedUsers')
            .populate('comments')
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
                            comments: [...(task.comments || []), newCommentId],
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

    async addChild(
        parentId: string,
        childId: string,
        sortAfterId?: string,
        session?: ClientSession,
    ): Promise<Task> {
        const { children = [] } = await this.getOneOrThrowById(parentId);

        let newChildren = [...children, childId];

        if (sortAfterId) {
            const sortAfterIndex = children.findIndex(
                (children) => String(children._id) === sortAfterId,
            );
            if (sortAfterIndex !== -1) {
                newChildren = [
                    ...children.slice(0, sortAfterIndex + 1),
                    childId,
                    ...children.slice(sortAfterIndex + 1),
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
                        children: newChildren,
                    },
                },
            )
            .session(session || undefined)
            .exec();
        return await this.getOneOrThrowById(parentId);
    }

    async addChildByPlainTask(
        parentTask: Task,
        childId: string,
        sortAfterId?: string,
        session?: ClientSession,
    ): Promise<Task> {
        const { children, _id } = parentTask;
        let newChildren = [...children, childId];

        if (sortAfterId) {
            const sortAfterIndex = children.findIndex(
                (children) => String(children._id) === sortAfterId,
            );
            if (sortAfterIndex !== -1) {
                newChildren = [
                    ...children.slice(0, sortAfterIndex + 1),
                    childId,
                    ...children.slice(sortAfterIndex + 1),
                ];
            } else {
                throw new BadRequestException('Sorting task not exists');
            }
        }

        await this.taskModel
            .updateOne(
                {
                    _id,
                },
                {
                    $set: {
                        children: newChildren,
                    },
                },
            )
            .session(session || undefined)
            .exec();
        return await this.getOneOrThrowById(_id);
    }

    async removeChild(parent: Task, childId: string, session?: ClientSession): Promise<Task> {
        await this.taskModel
            .updateOne(
                {
                    _id: parent._id,
                },
                {
                    $set: {
                        children: parent.children.filter(
                            (children) => String(children._id) !== String(childId),
                        ),
                    },
                },
            )
            .session(session || undefined)
            .exec();
        return await this.getOneOrThrowById(parent._id);
    }

    async sortChild(parent: Task, childId: string, sortAfterId: string, session?: ClientSession) {
        const { children, _id } = parent;
        if (sortAfterId) {
            const sortAfterIndex = children.findIndex(
                (children) => String(children._id) === sortAfterId,
            );
            if (sortAfterIndex !== -1) {
                const newChildren = [
                    ...children.slice(0, sortAfterIndex + 1),
                    childId,
                    ...children.slice(sortAfterIndex + 1),
                ];
                await this.taskModel
                    .updateOne(
                        {
                            _id,
                        },
                        {
                            $set: {
                                children: newChildren,
                            },
                        },
                    )
                    .session(session || undefined)
                    .exec();
            } else {
                throw new BadRequestException('Sorting task not exists');
            }
        }
    }

    // TODO: Need to refactor (to modules)
    async moveChild(
        user: User,
        { fromParentId, toParentId, childId, sortAfterId }: MoveTaskChildrenInput,
    ): Promise<[Task, Task?]> {
        const fromParent = await this.getOneOrThrowById(fromParentId);
        const project = await this.projectService.getOneAndCheckAccessOrThrowById(
            fromParent.project._id,
            user._id,
        );

        if (fromParentId && toParentId) {
            // move in not-top-depth tasks
            if (fromParentId === toParentId) {
                // move in same parent - just update sorting
                await this.sortChild(fromParent, childId, sortAfterId);
                return [await this.getOneOrThrowById(fromParentId)];
            } else {
                // move to another parent
                const toParent = await this.getOneOrThrowById(toParentId);

                await this.projectService.getOneAndCheckAccessOrThrowById(
                    toParent.project._id,
                    user._id,
                );

                let toChildren = [...toParent.children, childId];

                if (sortAfterId) {
                    const sortAfterIndex = toParent.children.findIndex(
                        (children) => String(children._id) === sortAfterId,
                    );
                    if (sortAfterIndex !== -1) {
                        toChildren = [
                            ...toParent.children.slice(0, sortAfterIndex + 1),
                            childId,
                            ...toParent.children.slice(sortAfterIndex + 1),
                        ];
                    } else {
                        throw new BadRequestException('Sorting task not exists');
                    }
                }

                const session = await this.connection.startSession();
                session.startTransaction();
                try {
                    await this.removeChild(fromParent, childId, session);
                    await this.taskModel
                        .updateOne(
                            {
                                _id: toParentId,
                            },
                            {
                                $set: {
                                    children: toChildren,
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
        } else {
            // move in include-top-depth tasks
            if (!fromParentId && toParentId) {
                // from: top-depth, to: not-top-depth
                const session = await this.connection.startSession();
                session.startTransaction();
                try {
                    const toParent = await this.getOneOrThrowById(toParentId);
                    await this.projectService.removeTopChild(project, childId, session);
                    const updated = await this.addChildByPlainTask(
                        toParent,
                        childId,
                        sortAfterId,
                        session,
                    );
                    await session.commitTransaction();
                    return [updated];
                } catch (err) {
                    console.error(err);
                    session.abortTransaction();
                    throw new InternalServerErrorException('Transaction aborted');
                } finally {
                    session.endSession();
                }
            } else if (fromParentId && !toParentId) {
                // from: not-top-depth, to: top-depth
                const session = await this.connection.startSession();
                session.startTransaction();
                try {
                    await this.removeChild(fromParent, childId, session);
                    await this.projectService.addTopChild(project, childId, sortAfterId, session);
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
            } else {
                // from: top-depth, to: top-depth
                await this.projectService.sortTopChild(project, childId, sortAfterId);
            }
        }
    }

    throwIfIsNotAuthor(task: Task | TaskComment, userId: string): void {
        if (!(String(task.author._id) === String(userId))) {
            throw new NotFoundException('Cannot access');
        }
    }
}
