import {
    forwardRef,
    Inject,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Company, CompanyDocument } from 'src/schemas/company.schema';
import { Connection, ClientSession } from 'mongoose';
import { SoftDeleteModel } from 'src/lib/plugins/soft-delete.plugin';
import { CreateCompanyInput } from './dto/create-company-input.dto';
import { User } from 'src/schemas/user.schema';
import { UserService } from '../user/user.service';
import { CreateUserInput } from '../user/dto/create-user-input.dto';
import { transaction } from 'src/lib/util/transaction';

@Injectable()
export class CompanyService {
    constructor(
        @InjectConnection() private connection: Connection,
        @InjectModel(Company.name) private companyModel: SoftDeleteModel<CompanyDocument>,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
    ) {}

    async create(input: CreateCompanyInput): Promise<Company> {
        const newCompany = new this.companyModel(input);
        return await newCompany.save();
    }

    async addUser(requester: User, user: CreateUserInput): Promise<Company> {
        this.userService.throwIfIsNotAdmin(requester);

        const company = await this.getOneOrThrowById(requester.company._id);

        await transaction<void>(this.connection, async (session) => {
            const newUser = await this.userService.createByCompany(company, user, session);
            await this.addExistingUser(company, newUser, session);
        });

        return await this.getOneOrThrowById(company._id);
    }

    async addExistingUser(company: Company, user: User, session?: ClientSession): Promise<boolean> {
        return (
            (await this.companyModel
                .updateOne(
                    { _id: company._id },
                    {
                        $set: {
                            users: [...company.users, user],
                        },
                    },
                )
                .session(session || undefined)
                .exec()) && true
        );
    }

    async getOneOrThrowById(id: string): Promise<Company> {
        const company = await this.companyModel.findById(id).populate('users').lean().exec();
        if (!company) {
            throw new NotFoundException('Company not exists');
        }
        return company;
    }

    async getUsersById(id: string, exceptUserId?: string): Promise<User[]> {
        const company = await this.getOneOrThrowById(id);
        return exceptUserId
            ? company.users.filter((user) => String(user._id) !== String(exceptUserId))
            : company.users;
    }
}
