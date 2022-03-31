import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { User, UserDocument } from 'src/schemas/user.schema';
import { CompanyService } from '../company/company.service';
import { CreateUserInput } from './dto/create-user-input';
import { compare, hash } from 'bcrypt';
import { sign, SignOptions, verify } from 'jsonwebtoken';
import { JwtPayload } from 'src/auth/types/jwt-payload.type';
import { JwtInput } from 'src/auth/types/jwt-input.type';
import { LoginInput } from './dto/login-input';
import { SoftDeleteModel } from 'src/lib/plugins/soft-delete.plugin';

@Injectable()
export class UserService {
    private readonly jwtOptions: SignOptions;
    private readonly jwtKey: string;

    constructor(
        @InjectConnection() private connection: Connection,
        @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
        private readonly companyService: CompanyService,
    ) {
        this.jwtOptions = {
            expiresIn: process.env.JWT_ACCESS_TOKEN_TTL,
        };
        this.jwtKey = process.env.JWT_SECRET_KEY;
    }

    verifyToken(token: string): JwtPayload {
        return verify(token, this.jwtKey) as JwtPayload;
    }

    createToken(jwtInput: JwtInput, isRefresh?: boolean): string {
        const payload: JwtPayload = {
            ...jwtInput,
            type: isRefresh ? 'REFRESH' : 'ACCESS',
        };

        return sign(payload, this.jwtKey, this.jwtOptions);
    }

    async login(input: LoginInput): Promise<User> {
        const user = await this.getOneOrThrowByEmail(input.email);

        const isPasswordValid = await compare(input.password, user.password);
        if (!isPasswordValid) {
            throw new NotFoundException('User not exists');
        }

        const {
            _id: userId,
            email,
            company: { _id: companyId },
            role,
        } = user;
        const _access = this.createToken({
            userId,
            companyId,
            email,
            role,
        });
        return {
            ...user,
            _access,
        };
    }

    async getOneOrThrowById(id: string): Promise<User> {
        const user = await this.userModel.findById(id).populate('company').lean().exec();
        if (!user) {
            throw new NotFoundException('User not exists');
        }
        return user;
    }

    async getOneOrThrowByEmail(email: string): Promise<User> {
        const user = await this.userModel.findOne({ email }).populate('company').lean().exec();
        if (!user) {
            throw new NotFoundException('User not exists');
        }
        return user;
    }

    async throwIfExistsByEmail(email: string): Promise<void> {
        const user = await this.userModel.findOne({ email }).lean().exec();
        if (user) {
            throw new ConflictException('User already exists');
        }
    }

    async create(input: CreateUserInput): Promise<User> {
        await this.throwIfExistsByEmail(input.email);

        const company = await this.companyService.getOneOrThrowById(input.companyId);

        const newUser = new this.userModel(input);
        newUser.company = company;
        newUser.password = await hash(input.password, 10);

        const session = await this.connection.startSession();
        session.startTransaction();
        try {
            await this.companyService.addUser(company, newUser, session);
            const { _id } = await newUser.save({ session });
            await session.commitTransaction();
            return await this.getOneOrThrowById(_id);
        } catch (err) {
            console.error(err);
            session.abortTransaction();
            throw new InternalServerErrorException('Transaction aborted');
        } finally {
            session.endSession();
        }
    }
}
