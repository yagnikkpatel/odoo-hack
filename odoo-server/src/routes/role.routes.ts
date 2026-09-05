import { Router } from 'express';
import { AppError } from '../errors/AppError';
import { requireAuth } from '../middlewares/auth.middleware';
import { getCurrentAuthUser } from '../services/current-auth-user.service';
import { getRoleConfiguration, parseRoleChanges, saveRoleChanges } from '../services/role-management.service';

export const roleRouter = Router();
roleRouter.use(requireAuth);
roleRouter.use(async (req, res, next) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const user = await getCurrentAuthUser(req.user.userId);
  if (user.role !== 'admin') throw new AppError(403, 'Only administrators can manage role permissions.');
  res.setHeader('Cache-Control', 'no-store, private');
  next();
});
roleRouter.get('/', async (_req, res) => {
  res.json({ success: true, data: await getRoleConfiguration() });
});
roleRouter.patch('/', async (req, res) => {
  const changes = parseRoleChanges(req.body);
  res.json({ success: true, data: await saveRoleChanges(changes) });
});
