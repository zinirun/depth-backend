import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { SkipAuth } from 'src/auth/decorators/skip-auth.decorator';
import { ContextResponse } from 'src/lib/decorators/context-response.decorator';
import { User } from 'src/schemas/user.schema';
import { CreateUserInput } from './dto/create-user-input';
import { LoginInput } from './dto/login-input';
import { UserService } from './user.service';

@Resolver()
export class UserResolver {
    constructor(private readonly userService: UserService) {}

    @SkipAuth()
    @Query(() => User)
    async login(@ContextResponse() response: any, @Args('input') input: LoginInput): Promise<User> {
        const user = await this.userService.login(input);
        response.cookie('x-token', user._access, {
            httpOnly: true,
        });
        return user;
    }

    @SkipAuth()
    @Mutation(() => User, {
        name: 'createUser',
    })
    async createOne(@Args('user') user: CreateUserInput): Promise<User> {
        return await this.userService.create(user);
    }
}
