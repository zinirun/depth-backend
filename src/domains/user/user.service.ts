import {
    BadRequestException,
    ConflictException,
    forwardRef,
    Inject,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { User, UserDocument } from 'src/schemas/user.schema';
import { CompanyService } from '../company/company.service';
import { CreateUserInput, OAuthInput } from './dto/create-user-input.dto';
import { compare, hash } from 'bcrypt';
import { sign, SignOptions, verify } from 'jsonwebtoken';
import { JwtPayload } from 'src/auth/types/jwt-payload.type';
import { JwtInput } from 'src/auth/types/jwt-input.type';
import { LoginInput } from './dto/login-input.dto';
import { SoftDeleteModel } from 'src/lib/plugins/soft-delete.plugin';
import { Response } from 'express';
import { ClientSession } from 'mongoose';
import { Company } from 'src/schemas/company.schema';
import { AssignPlainUserInput } from './dto/assign-plain-user-input.dto';
import { UserInviteStatus } from 'src/lib/enum/user-invite-status.enum';
import { UserRole } from 'src/lib/enum/user-role.enum';
import { UserAuthType } from 'src/lib/enum/user-auth-type.enum';

@Injectable()
export class UserService {
    private readonly jwtOptions: SignOptions;
    private readonly jwtKey: string;

    constructor(
        @InjectConnection() private connection: Connection,
        @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
        @Inject(forwardRef(() => CompanyService))
        private readonly companyService: CompanyService,
    ) {
        this.jwtOptions = {
            expiresIn: process.env.JWT_ACCESS_TOKEN_TTL,
        };
        this.jwtKey = process.env.JWT_SECRET_KEY;
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

    async loginWithOAuth(req: any, res: Response<any>): Promise<Response | void> {
        if (!req.user) {
            return res.status(400).json({
                success: false,
                message: 'No user provided',
            });
        }

        try {
            const {
                _id: userId,
                company: { _id: companyId },
                role,
                email,
            } = req.user;
            const token = this.createToken({ userId, companyId, role, email });
            res.cookie('x-access', token, { httpOnly: true });

            const { NODE_ENV, LOCAL_CLIENT_URL, CLIENT_URL } = process.env;
            res.redirect(`${NODE_ENV === 'local' ? LOCAL_CLIENT_URL : CLIENT_URL}/workspace`);
        } catch (err) {
            throw new UnauthorizedException();
        }
    }

    async getOneOrUpdateOAuth(input: OAuthInput): Promise<User> {
        const { email, ...$set } = input;

        const user = await this.getOneOrThrowByEmail(email);
        if (!user.oauthId) {
            await this.userModel
                .updateOne(
                    { _id: user._id },
                    {
                        $set,
                    },
                )
                .exec();
        }
        return user;
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

    async createByCompany(
        company: Company,
        input: CreateUserInput,
        session?: ClientSession,
    ): Promise<User> {
        await this.throwIfExistsByEmail(input.email);
        const newUser = new this.userModel(input);
        newUser.company = company;
        return await newUser.save({ session });
    }

    async assignInviteWithPlain(userId: string, input: AssignPlainUserInput): Promise<User> {
        const user = await this.getOneOrThrowById(userId);
        if (user.inviteStatus === UserInviteStatus.Assigned) {
            throw new BadRequestException('Already assigned user');
        }

        const { name, password: plainPassword } = input;
        await this.userModel
            .updateOne(
                { _id: user._id },
                {
                    $set: {
                        name,
                        password: await hash(plainPassword, 10),
                        inviteStatus: UserInviteStatus.Assigned,
                    },
                },
            )
            .exec();
        return await this.getOneOrThrowById(user._id);
    }

    async assignInviteWithOAuth(userId: string, name?: string): Promise<User> {
        const user = await this.getOneOrThrowById(userId);
        if (user.inviteStatus === UserInviteStatus.Assigned) {
            throw new BadRequestException('Already assigned user');
        }

        let $set: Record<string, any> = {
            inviteStatus: UserInviteStatus.Assigned,
        };

        if (name) {
            $set.name = name;
        }

        await this.userModel
            .updateOne(
                { _id: user._id },
                {
                    $set,
                },
            )
            .exec();
        return await this.getOneOrThrowById(user._id);
    }

    async throwIfExistsByEmail(email: string): Promise<void> {
        const user = await this.userModel.findOne({ email }).lean().exec();
        if (user) {
            throw new ConflictException('User already exists');
        }
    }

    throwIfIsNotAdmin(user: User): void {
        if (user.role !== UserRole.Admin) {
            throw new UnauthorizedException();
        }
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
}
