import jwt from "jsonwebtoken";

type JwtUser = {
  sub: string;
  email: string;
  role: string;
  emailVerified?: boolean;
  name?: string;
};

export function signTestJwt(user: JwtUser, secret = "test-secret") {
  return jwt.sign(
    {
      ...user,
      emailVerified: user.emailVerified ?? true,
    },
    secret,
    { expiresIn: "1h" },
  );
}
