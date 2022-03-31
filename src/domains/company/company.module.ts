import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from 'src/schemas/company.schema';
import { CompanyResolver } from './company.resolver';
import { CompanyService } from './company.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Company.name,
                schema: CompanySchema,
            },
        ]),
    ],
    providers: [CompanyResolver, CompanyService],
    exports: [CompanyService],
})
export class CompanyModule {}
