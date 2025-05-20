import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as NextAuthJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session extends DefaultSession {
    user?: {
      id?: string | null;
      isAdmin?: boolean | null;
    } & DefaultSession["user"]; // Mantiene las propiedades originales de DefaultSession["user"]
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User extends DefaultUser {
    // Estas son las propiedades que añadimos en el callback authorize y jwt
    id: string;
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends NextAuthJWT {
    // Estas son las propiedades que añadimos al token en el callback jwt
    id?: string;
    isAdmin?: boolean;
  }
} 