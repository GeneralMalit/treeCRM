import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "../constants/roles";

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  name?: string;
}
