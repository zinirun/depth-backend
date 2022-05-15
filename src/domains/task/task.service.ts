import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Connection } from 'mongoose';
import { User } from 'src/schemas/user.schema';
import { SoftDeleteModel } from 'src/lib/plugins/soft-delete.plugin';
import { Task, TaskDocument } from 'src/schemas/task.schema';
import { CreateTaskInput } from './dto/create-task-input.dto';
import { ProjectService } from '../project/project.service';
import { UpdateTaskInput } from './dto/update-task-input.dto';
import { ClientSession } from 'mongoose';
import { MoveTaskChildInput } from './dto/move-task-child-input.dto';
import { TaskComment, TaskCommentDocument } from 'src/schemas/task-comment.schema';
import { CreateTaskCommentInput } from './dto/create-task-comment-input.dto';
import { UpdateTaskCommentInput } from './dto/update-task-comment-input.dto';
import arrayMove from 'src/lib/util/array-move';
import { transaction } from 'src/lib/util/transaction';
import { MyTasks } from './dto/my-tasks.dto';
import { TaskStatus } from 'src/lib/enum/task-status.enum';
import * as moment from 'moment';

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
            sortIndex,
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

        const _id = await transaction<string>(this.connection, async (session) => {
            if (parentTaskId) {
                // task level; sub task (not top depth)
                const { _id } = await newTask.save({ session });
                await this.addChild(parentTaskId, _id, sortIndex, session);
                return _id;
            } else {
                // project level; task (top depth)
                const { _id } = await newTask.save({ session });
                await this.projectService.addTopChild(project, _id, sortIndex, session);
                return _id;
            }
        });

        await this.projectService.updateTaskUpdatedAt(projectId);
        return await this.getOneOrThrowById(_id);
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
        const { topChildren: $in } = await this.projectService.getOneAndCheckAccessOrThrowById(
            projectId,
            userId,
        );

        const tasks = await this.taskModel
            .find({
                _id: {
                    $in,
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

        return tasks.sort(
            (a, b) =>
                $in.findIndex((id) => a._id.equals(id)) - $in.findIndex((id) => b._id.equals(id)),
        );
    }

    async getAllInvolvedByDateAndUserId(userId: string): Promise<MyTasks> {
        const _today = moment().startOf('day');
        const dateCondition = {
            today: {
                $gte: _today.toDate(),
                $lte: moment(_today).endOf('day').toDate(),
            },
            thisWeek: {
                $gte: moment().startOf('week').toDate(),
                $lte: moment(_today).endOf('week').toDate(),
            },
            lastDays: (day: number) => ({
                $gte: moment().subtract(day, 'd').startOf('day').toDate(),
                $lte: moment(_today).endOf('day').toDate(),
            }),
        };
        const today = await this.getInvolvedOrAuthoredTasksWithLastDepth(userId, [
            {
                'deadline.to': {
                    $lte: dateCondition.today.$lte,
                },
            },
        ]);
        const thisWeek = await this.getInvolvedOrAuthoredTasksWithLastDepth(userId, [
            {
                'deadline.to': {
                    $lte: dateCondition.thisWeek.$lte,
                },
            },
        ]);
        const recent = await this.getInvolvedOrAuthoredTasksWithLastDepth(userId, [
            {
                createdAt: dateCondition.lastDays(3),
            },
        ]);
        return {
            today,
            thisWeek,
            recent,
        };
    }

    async getInvolvedOrAuthoredTasksWithLastDepth(
        userId: string,
        andCondition?: mongoose.FilterQuery<TaskDocument>[],
    ): Promise<Task[]> {
        return await this.taskModel
            .find({
                $or: [
                    {
                        author: userId,
                    },
                    {
                        involvedUsers: new mongoose.Types.ObjectId(userId),
                    },
                ],
                $and: [
                    {
                        children: { $size: 0 },
                    },
                    {
                        status: { $ne: TaskStatus.Done },
                    },
                    {
                        title: { $ne: '' },
                    },
                    ...andCondition,
                ],
            })
            .populate('author')
            .populate('project')
            // .populate('children')
            .populate('involvedUsers')
            .populate('comments')
            .lean()
            .exec();
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

        const newCommentId = await transaction<string>(this.connection, async (session) => {
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
            return newCommentId;
        });

        return await this.getOneCommentOrThrowById(newCommentId);
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
        sortIndex?: number,
        session?: ClientSession,
    ): Promise<Task> {
        const { children = [] } = await this.getOneOrThrowById(parentId);

        let newChildren = [...children, childId];

        if (sortIndex || sortIndex === 0) {
            newChildren = [...children.slice(0, sortIndex), childId, ...children.slice(sortIndex)];
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
        sortIndex?: number,
        session?: ClientSession,
    ): Promise<Task> {
        const { children, _id } = parentTask;
        let newChildren = [...children, childId];

        if (sortIndex || sortIndex === 0) {
            newChildren = [...children.slice(0, sortIndex), childId, ...children.slice(sortIndex)];
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

    async sortChild(parent: Task, childId: string, sortIndex?: number, session?: ClientSession) {
        const { children, _id } = parent;
        const originalIndex = children.findIndex((task) => String(task._id) === String(childId));
        if (originalIndex !== -1 && (sortIndex || sortIndex === 0)) {
            const toIndex = originalIndex > sortIndex ? sortIndex : sortIndex - 1;
            arrayMove(children, originalIndex, toIndex);
            await this.taskModel
                .updateOne(
                    {
                        _id,
                    },
                    {
                        $set: {
                            children,
                        },
                    },
                )
                .session(session || undefined)
                .exec();
        }
    }

    // TODO: Need to refactor (to modules)
    async moveChild(
        user: User,
        { fromParentId, toParentId, childId, sortIndex }: MoveTaskChildInput,
    ): Promise<[Task, Task?]> {
        const fromParent = fromParentId ? await this.getOneOrThrowById(fromParentId) : undefined;
        const toParent = toParentId ? await this.getOneOrThrowById(toParentId) : undefined;
        const project = await this.projectService.getOneAndCheckAccessOrThrowById(
            fromParentId
                ? fromParent.project._id
                : (
                      await this.getOneOrThrowById(childId)
                  ).project._id,
            user._id,
        );

        if (fromParentId && toParentId) {
            // move in not-top-depth tasks
            if (fromParentId === toParentId) {
                // move in same parent - just update sorting
                await this.sortChild(fromParent, childId, sortIndex);
                return [await this.getOneOrThrowById(fromParentId)];
            } else {
                // move to another parent

                await this.projectService.getOneAndCheckAccessOrThrowById(
                    toParent.project._id,
                    user._id,
                );

                let toChildren = [...toParent.children, childId];

                if (sortIndex || sortIndex === 0) {
                    toChildren = [
                        ...toParent.children.slice(0, sortIndex),
                        childId,
                        ...toParent.children.slice(sortIndex),
                    ];
                }

                await transaction<void>(this.connection, async (session) => {
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
                });

                return [
                    await this.getOneOrThrowById(fromParentId),
                    await this.getOneOrThrowById(toParentId),
                ];
            }
        } else {
            // move in include-top-depth tasks
            if (!fromParentId && toParentId) {
                // from: top-depth, to: not-top-depth

                const updated = await transaction<Task>(this.connection, async (session) => {
                    await this.projectService.removeTopChild(project, childId, session);
                    return await this.addChildByPlainTask(toParent, childId, sortIndex, session);
                });

                return [updated];
            } else if (fromParentId && !toParentId) {
                // from: not-top-depth, to: top-depth
                await transaction<void>(this.connection, async (session) => {
                    await this.removeChild(fromParent, childId, session);
                    await this.projectService.addTopChild(project, childId, sortIndex, session);
                });

                return [await this.getOneOrThrowById(fromParentId)];
            } else {
                // from: top-depth, to: top-depth
                await this.projectService.sortTopChild(project, childId, sortIndex);
                return [await this.getOneOrThrowById(childId)];
            }
        }
    }

    throwIfIsNotAuthor(task: Task | TaskComment, userId: string): void {
        if (!(String(task.author._id) === String(userId))) {
            throw new NotFoundException('Cannot access');
        }
    }
}
