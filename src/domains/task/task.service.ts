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

@Injectable()
export class TaskService {
    constructor(
        @InjectConnection() private connection: Connection,
        @InjectModel(Task.name) private taskModel: SoftDeleteModel<TaskDocument>,
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
                { session },
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
    ): Promise<[Task, Task]> {
        const fromParent = await this.getOneOrThrowById(fromParentId);
        const toParent = await this.getOneOrThrowById(toParentId);

        await this.projectService.getOneAndCheckAccessOrThrowById(fromParent.project._id, user._id);
        await this.projectService.getOneAndCheckAccessOrThrowById(toParent.project._id, user._id);

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

    throwIfIsNotAuthor(task: Task, userId: string): void {
        if (!(String(task.author._id) === String(userId))) {
            throw new NotFoundException('Cannot access');
        }
    }
}
