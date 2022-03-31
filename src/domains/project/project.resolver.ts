import { Resolver, Mutation, Args, Query, ID } from '@nestjs/graphql';
import { GetUser } from 'src/lib/decorators/get-user.decorator';
import { Project } from 'src/schemas/project.schema';
import { User } from 'src/schemas/user.schema';
import { CreateProjectInput } from './dto/create-project-input.dto';
import { UpdateProjectInput } from './dto/update-project-input.dto';
import { ProjectService } from './project.service';

@Resolver()
export class ProjectResolver {
    constructor(private readonly projectService: ProjectService) {}

    @Mutation(() => Project, {
        name: 'createProject',
    })
    async createOne(
        @GetUser() user: User,
        @Args('project') project: CreateProjectInput,
    ): Promise<Project> {
        return await this.projectService.create(project, user);
    }

    @Query(() => Project, {
        name: 'project',
    })
    async getOne(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
    ): Promise<Project> {
        return await this.projectService.getOneAndCheckAccessOrThrowById(id, user._id);
    }

    @Query(() => [Project], {
        name: 'projects',
    })
    async getAll(@GetUser() user: User): Promise<Project[]> {
        return await this.projectService.getAllByCompanyId(user.company._id);
    }

    @Mutation(() => Project, {
        name: 'updateProject',
    })
    async update(
        @GetUser() user: User,
        @Args('project') project: UpdateProjectInput,
    ): Promise<Project> {
        return await this.projectService.update(project, user._id);
    }

    @Mutation(() => ID, {
        name: 'deleteProject',
    })
    async delete(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
    ): Promise<string> {
        return await this.projectService.remove(id, user._id);
    }

    @Mutation(() => ID, {
        name: 'restoreProject',
    })
    async restore(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
    ): Promise<string> {
        return await this.projectService.restore(id, user._id);
    }

    @Mutation(() => Project, {
        name: 'inviteProject',
    })
    async addAccesses(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
        @Args('userIds', { type: () => [ID] }) userIds: string[],
    ): Promise<Project> {
        return await this.projectService.addAccesses(id, userIds, user._id);
    }

    @Mutation(() => Project, {
        name: 'disinviteProject',
    })
    async removeAccesses(
        @GetUser() user: User,
        @Args('id', { type: () => ID }) id: string,
        @Args('userIds', { type: () => [ID] }) userIds: string[],
    ): Promise<Project> {
        return await this.projectService.removeAccesses(id, userIds, user._id);
    }
}
