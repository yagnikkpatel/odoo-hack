import { Router } from "express";
import { queryRecord, uuidParam } from "../lib/http";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import * as roleService from "../services/admin.role.service";
import * as userService from "../services/admin.user.service";

export const adminRouter = Router();

// Mounted at /admin in routes/index.ts. `authenticate` is router-wide, which is only safe
// because the router owns a path prefix — mounted bare it would swallow unmatched routes
// and answer 401 where the API should answer 404.
adminRouter.use(authenticate);

const manageUsers = requirePermission("admin.user.manage");
const manageRoles = requirePermission("admin.role.manage");

adminRouter.get("/users", manageUsers, async (req, res, next) => {
  try {
    const { rows, meta } = await userService.list(queryRecord(req));

    res.status(200).json({ success: true, data: rows, meta });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users", manageUsers, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await userService.create(req.body) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users/:userId", manageUsers, async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await userService.getById(uuidParam(req, "userId")) });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:userId", manageUsers, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await userService.update(uuidParam(req, "userId"), req.body),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/users/:userId", manageUsers, async (req, res, next) => {
  try {
    await userService.deactivate(uuidParam(req, "userId"));

    res.status(200).json({ success: true, message: "User deactivated." });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/roles", manageRoles, async (_req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await roleService.listRoles() });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/roles/:roleId/permissions", manageRoles, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await roleService.getRolePermissions(uuidParam(req, "roleId")),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/roles/:roleId/permissions", manageRoles, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await roleService.setRolePermissions(
        uuidParam(req, "roleId"),
        req.body,
        req.user!.role,
      ),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/permissions", manageRoles, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await roleService.listPermissions(queryRecord(req)),
    });
  } catch (err) {
    next(err);
  }
});
