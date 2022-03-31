import { UserRole } from 'src/lib/enum/user-role.enum';

export class JwtPayload {
    type: 'ACCESS' | 'REFRESH';
    userId: string;
    companyId: string;
    role: UserRole;
    email: string;
}
