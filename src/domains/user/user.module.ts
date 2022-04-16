import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoogleStrategy } from 'src/auth/strategies/google.strategy';
import { User, UserSchema } from 'src/schemas/user.schema';
import { CompanyModule } from '../company/company.module';
import { UserAuthController } from './user.controller';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: User.name,
                schema: UserSchema,
            },
        ]),
        forwardRef(() => CompanyModule),
    ],
    providers: [UserResolver, UserService, GoogleStrategy],
    controllers: [UserAuthController],
    exports: [UserService],
})
export class UserModule {}
