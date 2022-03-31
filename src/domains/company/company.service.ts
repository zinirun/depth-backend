import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Company, CompanyDocument } from 'src/schemas/company.schema';
import { Connection, ClientSession } from 'mongoose';
import { SoftDeleteModel } from 'src/lib/plugins/soft-delete.plugin';
import { CreateCompanyInput } from './dto/create-company-input.dto';
import { User } from 'src/schemas/user.schema';

@Injectable()
export class CompanyService {
    constructor(
        @InjectConnection() private connection: Connection,
        @InjectModel(Company.name) private companyModel: SoftDeleteModel<CompanyDocument>,
    ) {}

    async create(input: CreateCompanyInput): Promise<Company> {
        const newCompany = new this.companyModel(input);
        return await newCompany.save();
    }

    async addUser(company: Company, user: User, session?: ClientSession): Promise<boolean> {
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
        const company = await this.companyModel.findById(id).lean().exec();
        if (!company) {
            throw new NotFoundException('Company not exists');
        }
        return company;
    }
}
