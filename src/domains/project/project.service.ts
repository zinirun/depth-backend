import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Project, ProjectDocument } from 'src/schemas/project.schema';
import { CreateProjectInput } from './dto/create-project-input.dto';
import { User } from 'src/schemas/user.schema';
import { SoftDeleteModel } from 'src/lib/plugins/soft-delete.plugin';
import { UpdateProjectInput } from './dto/update-project-input.dto';
import { ClientSession } from 'mongoose';

@Injectable()
export class ProjectService {
    constructor(
        @InjectConnection() private connection: Connection,
        @InjectModel(Project.name) private projectModel: SoftDeleteModel<ProjectDocument>,
    ) {}

    async create(input: CreateProjectInput, user: User): Promise<Project> {
        if (!input.accesses.includes(String(user._id))) {
            input.accesses.unshift(user._id);
        }
        const newProject = new this.projectModel(input);

        newProject.company = user.company;
        newProject.manager = user;

        const { _id } = await newProject.save();
        return await this.getOneOrThrowById(_id);
    }

    async getOneOrThrowById(id: string): Promise<Project> {
        const project = await this.projectModel
            .findById(id)
            .populate('company')
            .populate('accesses')
            .populate('manager')
            .lean()
            .exec();
        if (!project) {
            throw new NotFoundException('Project not exists');
        }
        return project;
    }

    async getAllByCompanyId(companyId: string): Promise<Project[]> {
        const projects = await this.projectModel
            .find({
                company: companyId,
            })
            .populate('company')
            .populate('accesses')
            .populate('manager')
            .lean()
            .exec();
        return projects;
    }

    async getOneAndCheckAccessOrThrowById(id: string, userId: string): Promise<Project> {
        const project = await this.projectModel
            .findById(id)
            .populate('company')
            .populate('accesses')
            .populate('manager')
            .lean()
            .exec();
        if (!project) {
            throw new NotFoundException('Project not exists');
        }
        this.throwIfCannotAccess(project, userId);

        return project;
    }

    async getAccessesById(id: string, userId: string): Promise<User[]> {
        const project = await this.getOneAndCheckAccessOrThrowById(id, userId);
        return project.accesses;
    }

    async update(input: UpdateProjectInput, requesterId: string): Promise<Project> {
        const { id, title } = input;
        const project = await this.getOneOrThrowById(id);
        this.throwIfIsNotManager(project, requesterId);

        await this.projectModel
            .updateOne(
                {
                    _id: id,
                },
                {
                    $set: {
                        title,
                    },
                },
            )
            .exec();
        return await this.getOneOrThrowById(id);
    }

    async remove(id: string, requesterId: string): Promise<string> {
        const project = await this.getOneOrThrowById(id);
        this.throwIfIsNotManager(project, requesterId);
        await this.projectModel.softDelete({
            _id: id,
        });
        return id;
    }

    async restore(id: string, requesterId: string): Promise<string> {
        const project = await this.projectModel.findDeletedById(id);
        this.throwIfIsNotManager(project, requesterId);
        await this.projectModel.restore({
            _id: id,
        });
        return id;
    }

    async addAccesses(id: string, addUserIds: string[], requesterId: string): Promise<Project> {
        const project = await this.getOneAndCheckAccessOrThrowById(id, requesterId);

        const currentAccesses = project.accesses.map((access) => String(access._id));
        const accessesToCreate = addUserIds.filter(
            (accessUserId) => !currentAccesses.includes(accessUserId),
        );

        await this.projectModel
            .updateOne(
                {
                    _id: id,
                },
                {
                    $set: {
                        accesses: [...project.accesses, ...accessesToCreate],
                    },
                },
            )
            .exec();
        return await this.getOneOrThrowById(id);
    }

    async removeAccesses(
        id: string,
        removeUserIds: string[],
        requesterId: string,
    ): Promise<Project> {
        const project = await this.getOneAndCheckAccessOrThrowById(id, requesterId);

        await this.projectModel
            .updateOne(
                {
                    _id: id,
                },
                {
                    $set: {
                        accesses: project.accesses.filter(
                            (access) => !removeUserIds.includes(String(access._id)),
                        ),
                    },
                },
            )
            .exec();
        return await this.getOneOrThrowById(id);
    }

    async updateTaskUpdatedAt(id: string): Promise<boolean> {
        return (
            (await this.projectModel
                .updateOne(
                    {
                        _id: id,
                    },
                    {
                        $set: {
                            taskUpdatedAt: new Date(),
                        },
                    },
                )
                .exec()) && true
        );
    }

    async addTopChild(
        project: Project,
        childTaskId: string,
        sortAfterTaskId: string,
        session?: ClientSession,
    ): Promise<Project> {
        const { topChildren = [], _id } = project;
        let newTopChildren = [...topChildren, childTaskId];

        if (sortAfterTaskId) {
            const sortAfterIndex = topChildren.findIndex(
                (children) => String(children._id) === sortAfterTaskId,
            );
            if (sortAfterIndex !== -1) {
                newTopChildren = [
                    ...topChildren.slice(0, sortAfterIndex + 1),
                    childTaskId,
                    ...topChildren.slice(sortAfterIndex),
                ];
            } else {
                throw new BadRequestException('Sorting task not exists');
            }
        }

        await this.projectModel
            .updateOne(
                {
                    _id,
                },
                {
                    $set: {
                        topChildren: newTopChildren,
                    },
                },
            )
            .session(session || undefined)
            .exec();
        return await this.getOneOrThrowById(project._id);
    }

    async removeTopChild(
        project: Project,
        childTaskId: string,
        session?: ClientSession,
    ): Promise<Project> {
        const { _id, topChildren = [] } = project;
        await this.projectModel
            .updateOne(
                {
                    _id,
                },
                {
                    $set: {
                        topChildren: topChildren.filter(
                            (children) => String(children._id) !== String(childTaskId),
                        ),
                    },
                },
            )
            .session(session || undefined)
            .exec();
        return await this.getOneOrThrowById(_id);
    }

    async sortTopChild(
        project: Project,
        childTaskId: string,
        sortAfterTaskId: string,
        session?: ClientSession,
    ) {
        const { _id, topChildren = [] } = project;
        if (sortAfterTaskId) {
            const sortAfterIndex = topChildren.findIndex(
                (children) => String(children._id) === sortAfterTaskId,
            );
            if (sortAfterIndex !== -1) {
                const children = [
                    topChildren.slice(0, sortAfterIndex + 1),
                    childTaskId,
                    topChildren.slice(sortAfterIndex + 1),
                ];
                await this.projectModel
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
            } else {
                throw new BadRequestException('Sorting task not exists');
            }
        }
    }

    throwIfCannotAccess(project: Project, userId: string): void {
        if (
            !(
                String(project.manager._id) === String(userId) ||
                project.accesses.map((access) => String(access._id)).includes(String(userId))
            )
        ) {
            throw new NotFoundException('Cannot access');
        }
    }

    throwIfIsNotManager(project: Project, userId: string): void {
        if (!(String(project.manager._id) === String(userId))) {
            throw new NotFoundException('Cannot access');
        }
    }
}
