import { UserRole } from 'src/lib/enum/user-role.enum';

export class JwtInput {
    readonly userId: string;
    readonly companyId: string;
    readonly role: UserRole;
    readonly email: string;
}
