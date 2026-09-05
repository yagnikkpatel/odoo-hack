import { TokenPayload } from "./user";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      /** Permission codes for the caller's role, populated by `requirePermission`. */
      permissions?: Set<string>;
    }
  }
}

export {};
