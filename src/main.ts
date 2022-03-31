import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import * as compression from 'compression';
import * as hpp from 'hpp';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
config();

async function bootstrap() {
    const port = process.env.PORT || 5000;
    console.log(`[${port}] ENVIRONMENT: ${process.env.NODE_ENV}`);
    process.env.NODE_ENV = process.env.NODE_ENV || 'local';
    +process.env.DEBUG_PROD && console.log('Got DEBUG_PROD: Using PRODUCTION DB');

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: process.env.NODE_ENV === 'local' ? undefined : ['error', 'warn'],
    });
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        app.enable('trust proxy'); // for using rate-limiter in ELB
        app.use(
            helmet({
                contentSecurityPolicy: process.env.NODE_ENV === 'production',
            }),
        );
        app.use(hpp());
        app.use(
            '/graphql',
            rateLimit({
                windowMs: 60, // 1 minutes
                max: 120, // limit each IP to 100 requests per windowMs
            }),
        );
    }
    app.enableCors({
        origin: process.env.NODE_ENV === 'production' ? ['https://depth.so'] : true,
        credentials: true,
    });

    app.use(cookieParser());
    app.use(compression());

    await app.listen(port);
}
bootstrap();
