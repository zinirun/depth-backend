import {
    CanActivate,
    ExecutionContext,
    Injectable,
    NotAcceptableException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { SKIP_AUTH } from '../decorators/skip-auth.decorator';
import { UserService } from 'src/domains/user/user.service';
import { UserRole } from 'src/lib/enum/user-role.enum';
import { ROLES_KEY } from '../decorators/user-roles.decorator';
import { SYSTEM_AUTH } from '../decorators/system-auth.decorator';
import { UserInviteStatus } from 'src/lib/enum/user-invite-status.enum';
import { User } from 'src/schemas/user.schema';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly userService: UserService, private reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        /**
         * Skip authentication
         */
        const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (skipAuth) {
            return true;
        }

        const request = GqlExecutionContext.create(context).getContext().req;

        const token =
            request?.headers?.authorization?.split(' ')[1] ||
            (request?.cookies && request?.cookies['x-access']);

        const systemAuth = this.reflector.getAllAndOverride<boolean>(SYSTEM_AUTH, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (systemAuth) {
            if (process.env.SYSTEM_KEY === token) {
                return true;
            } else {
                throw new NotFoundException();
            }
        }

        if (token) {
            let user: User;
            try {
                const jwtPayload = this.userService.verifyToken(token);
                user = await this.userService.getOneOrThrowById(jwtPayload.userId);
            } catch {
                throw new UnauthorizedException();
            }

            if (user.inviteStatus !== UserInviteStatus.Assigned) {
                throw new NotAcceptableException({
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    authType: user.authType,
                    companyName: user.company.name,
                });
            }

            // attach user data to request
            request.user = user;

            // check roles
            const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
                context.getHandler(),
                context.getClass(),
            ]);
            if (!requiredRoles || requiredRoles.length === 0) {
                return true;
            }
            return requiredRoles.some((role) => user.role.includes(role));
        } else {
            throw new UnauthorizedException('Empty credentials in your request');
        }
    }
}
