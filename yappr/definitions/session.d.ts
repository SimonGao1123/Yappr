import 'express-session';

declare module 'express-session' {
    interface SessionData {
        userId?: number;
        username?: string;
    }
}
// changes from Cookie: cookie to storing userId and username
// session type NOTE: userId is LOWERCASE d
