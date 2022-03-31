import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from 'src/schemas/project.schema';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Project.name,
                schema: ProjectSchema,
            },
        ]),
    ],
    providers: [ProjectResolver, ProjectService],
    exports: [ProjectService],
})
export class ProjectModule {}
