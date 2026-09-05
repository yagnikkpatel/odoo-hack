import bcrypt from "bcryptjs";
import { AppError } from "../errors/AppError";
import { findAuthUserByEmail } from "../repositories/user.repository";
import { signAccessToken } from "../lib/jwt";
import { LoginInput } from "../types/user.dto";
import { UserRole } from "../types/user";

type LoginResult = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await findAuthUserByEmail(input.email);

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.status !== "active") {
    throw new AppError(403, "User account is inactive");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}
