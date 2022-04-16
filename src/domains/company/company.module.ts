import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from 'src/schemas/company.schema';
import { UserModule } from '../user/user.module';
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
        forwardRef(() => UserModule),
    ],
    providers: [CompanyResolver, CompanyService],
    exports: [CompanyService],
})
export class CompanyModule {}
