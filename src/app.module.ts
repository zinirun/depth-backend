import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { join } from 'path';
import { AppController } from './app.controller';
import { ProjectModule } from './domains/project/project.module';
import { CompanyModule } from './domains/company/company.module';
import { UserModule } from './domains/user/user.module';
import { DateScalar } from './lib/scalars/date.scalar';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/guards/auth.guard';
import { TaskModule } from './domains/task/task.module';

config();

const getDBUri = () => {
    if (process.env.NODE_ENV === 'production' || +process.env.DEBUG_PROD) {
        return `mongodb://${process.env.DOC_DB_USER}:${process.env.DOC_DB_PASS}@${process.env.DOC_DB_HOST}/?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;
    }
    return `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`;
};

const getDBOptions: () => MongooseModuleOptions = () => {
    if (process.env.NODE_ENV === 'production' || +process.env.DEBUG_PROD) {
        return {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ssl: true,
            sslValidate: true,
            // sslCA: [readFileSync(`${__dirname}/../_ca/rds-combined-ca-bundle.pem`)] as any,
            tlsCAFile: `${__dirname}/../_ca/rds-combined-ca-bundle.pem`,
        };
    }
    return {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    };
};

@Module({
    imports: [
        MongooseModule.forRoot(getDBUri(), getDBOptions()),
        GraphQLModule.forRoot({
            driver: ApolloDriver,
            autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
            installSubscriptionHandlers: true,
            context: ({ req, res, connection }) =>
                req
                    ? {
                          req,
                          res,
                      }
                    : {
                          req: {
                              headers: connection.context,
                          },
                      },
            cors: {
                credentials: true,
                origin: true,
            },
            playground: process.env.NODE_ENV !== 'production',
            introspection: process.env.NODE_ENV !== 'production',
        }),
        ProjectModule,
        CompanyModule,
        UserModule,
        TaskModule,
    ],
    controllers: [AppController],
    providers: [
        DateScalar,
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
    ],
})
export class AppModule {}

// export class AppModule implements NestModule {
//     private readonly isDev: boolean = process.env.NODE_ENV === 'local' ? true : false;

//     configure(consumer: MiddlewareConsumer) {
//         consumer.apply(LoggerMiddleware).forRoutes('*');
//         mongoose.set('debug', this.isDev);
//     }
// }
