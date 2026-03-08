import jwt from "jsonwebtoken";

type JwtUser = {
  sub: string;
  email: string;
  role: string;
  name?: string;
};

export function signTestJwt(user: JwtUser, secret = "test-secret") {
  return jwt.sign(user, secret, { expiresIn: "1h" });
}
