import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { SkipAuth } from 'src/auth/decorators/skip-auth.decorator';
import { Company } from 'src/schemas/company.schema';
import { CompanyService } from './company.service';
import { CreateCompanyInput } from './dto/create-company-input.dto';

@Resolver()
export class CompanyResolver {
    constructor(private readonly companyService: CompanyService) {}

    @SkipAuth()
    @Mutation(() => Company, {
        name: 'createCompany',
    })
    async createOne(@Args('company') company: CreateCompanyInput): Promise<Company> {
        return await this.companyService.create(company);
    }
}
