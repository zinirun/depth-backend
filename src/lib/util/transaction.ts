import { ClientSession, Connection } from 'mongoose';

export const transaction = async <T>(
    conn: Connection,
    fn: (session: ClientSession) => any,
    options?,
): Promise<T> => {
    const session = await conn.startSession();

    try {
        return await new Promise((resolve, reject) => {
            let result: any;
            session
                .withTransaction(() => fn(session).then((res: any) => (result = res)), options)
                .then(() => resolve(result as T))
                .catch(reject);
        });
    } finally {
        session.endSession();
    }
};
