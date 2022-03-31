import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from 'src/schemas/user.schema';

export const GetUser = createParamDecorator((_, context: ExecutionContext): User => {
    const request = GqlExecutionContext.create(context).getContext().req;
    return request.user;
});
