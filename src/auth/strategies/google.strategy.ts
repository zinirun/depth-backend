import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { config } from 'dotenv';
import { Profile } from 'passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/domains/user/user.service';
import { User } from 'src/schemas/user.schema';
import { OAuthInput } from 'src/domains/user/dto/create-user-input.dto';
import { UserAuthType } from 'src/lib/enum/user-auth-type.enum';

config();

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private readonly userService: UserService) {
        const {
            OAUTH_GOOGLE_CLIENT: clientID,
            OAUTH_GOOGLE_SECRET: clientSecret,
            OAUTH_GOOGLE_CALLBACK: callbackRoute,
            API_URL,
            NODE_ENV,
        } = process.env;
        const callbackURL =
            NODE_ENV === 'local'
                ? 'http://localhost:5000' + callbackRoute
                : API_URL + callbackRoute;
        super({
            clientID,
            clientSecret,
            callbackURL,
            scope: ['email', 'profile'],
        });
    }

    async validate(_accessToken: string, _refreshToken: string, profile: Profile): Promise<User> {
        const {
            provider: oauthProvider,
            id: oauthId,
            displayName: name = 'Anonymous',
            emails,
            photos,
        } = profile;
        const oauthInput: OAuthInput = {
            oauthProvider,
            oauthId,
            name: name,
            email: emails ? emails[0].value : null,
            authType: UserAuthType.Google,
        };
        const user = await this.userService.getOneOrUpdateOAuth(oauthInput);
        if (!user) {
            throw new UnauthorizedException();
        }
        return user;
    }
}
