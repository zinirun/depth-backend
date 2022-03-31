import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

interface ApiInfo {
    api: string;
    maintainer: string;
    environment: string;
}

@Controller()
export class AppController {
    @Get()
    getApiInfo(@Res() response: Response): Response<ApiInfo> {
        return response.status(200).json({
            api: 'depth-api',
            maintainer: 'depth.so',
            environment: process.env.NODE_ENV,
        });
    }
}
