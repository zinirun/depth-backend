import { Resolver, Args, Query, Mutation, ID } from '@nestjs/graphql';
import { SkipAuth } from 'src/auth/decorators/skip-auth.decorator';
import { ContextResponse } from 'src/lib/decorators/context-response.decorator';
import { GetUser } from 'src/lib/decorators/get-user.decorator';
import { User } from 'src/schemas/user.schema';
import { AssignPlainUserInput } from './dto/assign-plain-user-input.dto';
import { LoginInput } from './dto/login-input.dto';
import { UserService } from './user.service';

@Resolver()
export class UserResolver {
    constructor(private readonly userService: UserService) {}

    @SkipAuth()
    @Query(() => User)
    async login(@ContextResponse() response: any, @Args('input') input: LoginInput): Promise<User> {
        const user = await this.userService.login(input);
        response.cookie('x-access', user._access, {
            httpOnly: true,
        });
        return user;
    }

    @Query(() => User, {
        name: 'me',
    })
    async verify(@GetUser() user: User): Promise<User> {
        return user;
    }

    @Query(() => Boolean)
    logout(@ContextResponse() response: any): boolean {
        response.clearCookie('x-access');
        return true;
    }

    @Mutation(() => User)
    async assignInviteWithPlain(
        @Args('id', {
            type: () => ID,
        })
        id: string,
        @Args('input') input: AssignPlainUserInput,
    ): Promise<User> {
        return await this.userService.assignInviteWithPlain(id, input);
    }

    @Mutation(() => User)
    async assignInviteWithOAuth(
        @Args('id', {
            type: () => ID,
        })
        id: string,
    ): Promise<User> {
        return await this.userService.assignInviteWithOAuth(id);
    }
}
