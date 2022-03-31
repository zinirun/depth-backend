import {
    CanActivate,
    ExecutionContext,
    Injectable,
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
            (request?.cookies && request?.cookies['x-token']);

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
            try {
                const jwtPayload = this.userService.verifyToken(token);
                const user = await this.userService.getOneOrThrowById(jwtPayload.userId);

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
            } catch {
                throw new UnauthorizedException();
            }
        } else {
            throw new UnauthorizedException('Empty credentials in your request');
        }
    }
}
