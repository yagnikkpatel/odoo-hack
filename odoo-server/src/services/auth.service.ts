import { AppError } from "../errors/AppError";
import { getGoogleAuthUrl, getGoogleUserFromAuthCode } from "../lib/google";
import { signAccessToken } from "../lib/jwt";
import {
  createGoogleUser,
  createUser,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserByGoogleId,
  linkGoogleIdToUser,
} from "../repositories/user.repository";
import bcrypt from "bcryptjs";
import { User } from "../types/user";

export async function registerUser(
  email: string,
  password: string,
): Promise<void> {
  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }

  // homwork - create one more folder called constants and keep this 6 in a constant and use this here
  if (password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters long");
  }

  const normalizeEmail = email.toLowerCase().trim();

  // find the user if its already present in db or not
  // if yes then we will not allow to register with same email again
  // thats it -> vv imp

  const existingUser = await findUserByEmail(normalizeEmail);

  if (existingUser) {
    throw new AppError(409, "Email already present");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await createUser(normalizeEmail, passwordHash);
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }

  const normalizeEmail = email.toLowerCase().trim();
  const user = await findUserByEmailWithPassword(normalizeEmail);

  if (!user?.password_hash) {
    throw new AppError(401, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError(401, "Invalid email or password");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { accessToken };
}

export function startGoogleLogin(): string {
  return getGoogleAuthUrl();
}

function createAccessTokenForUser(user: User): string {
  return signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
}

export async function loginWithGoogle(
  code: string,
): Promise<{ accessToken: string }> {
  const googleProfile = await getGoogleUserFromAuthCode(code);

  let user = await findUserByGoogleId(googleProfile.googleId);

  if (!user) {
    user = await findUserByEmail(googleProfile.email);

    if (user) {
      // link this google account to the existing email user

      user = await linkGoogleIdToUser(user.id, googleProfile.googleId);
    } else {
      // first time login - create the user in postgreDB
      user = await createGoogleUser(
        googleProfile.email,
        googleProfile.googleId,
      );
    }
  }

  const accessToken = createAccessTokenForUser(user);

  return { accessToken };
}
