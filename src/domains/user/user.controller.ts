import { Controller, Get, Post, Request, Response, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { SkipAuth } from 'src/auth/decorators/skip-auth.decorator';
import { UserService } from './user.service';

@Controller('auth')
export class UserAuthController {
    constructor(private readonly userService: UserService) {}

    @SkipAuth()
    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Request() req: ExpressRequest) {}

    @SkipAuth()
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(
        @Request() request: ExpressRequest,
        @Response() response: ExpressResponse,
    ): Promise<ExpressResponse | void> {
        return await this.userService.loginWithOAuth(request, response);
    }

    @Post('logout')
    logout(@Response() response: ExpressResponse): boolean {
        response.clearCookie('x-access');
        return true;
    }
}
