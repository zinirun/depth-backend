export type SavesByKind<T> = {
    update: T[];
    create: T[];
    origin: T[];
};
