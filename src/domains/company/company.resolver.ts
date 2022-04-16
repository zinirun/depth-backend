import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { SkipAuth } from 'src/auth/decorators/skip-auth.decorator';
import { GetUser } from 'src/lib/decorators/get-user.decorator';
import { Company } from 'src/schemas/company.schema';
import { User } from 'src/schemas/user.schema';
import { CreateUserInput } from '../user/dto/create-user-input.dto';
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
    @Mutation(() => Company, {
        name: 'inviteUserToCompany',
    })
    async inviteUser(
        @GetUser() requester: User,
        @Args('user', {
            type: () => CreateUserInput,
        })
        input: CreateUserInput,
    ): Promise<Company> {
        return await this.companyService.addUser(requester, input);
    }
}
