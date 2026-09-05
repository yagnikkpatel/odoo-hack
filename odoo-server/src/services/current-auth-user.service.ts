import { AppError } from "../errors/AppError";
import { findUserById } from "../repositories/user.repository";

export async function getCurrentAuthUser(userId: string) {
  // Read current profile/status/role from DB, not stale JWT claims or cached data.
  const user = await findUserById(userId);
  if (!user) throw new AppError(401, "User account no longer exists");
  if (user.status !== "active") throw new AppError(403, "User account is inactive");
  return { id: user.id, email: user.email, role: user.role, name: user.name };
}
