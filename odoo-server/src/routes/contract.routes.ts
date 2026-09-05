import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  createContractHandler,
  deleteContractHandler,
  getContractHandler,
  listContractsHandler,
  updateContractHandler,
} from "../controllers/contract.controller";

export const contractRouter = Router();

contractRouter.use(requireAuth);

contractRouter.post(
  "/",
  requirePermission("contract:create"),
  createContractHandler,
);

contractRouter.get(
  "/",
  requirePermission("contract:read"),
  listContractsHandler,
);

contractRouter.get(
  "/:id",
  requirePermission("contract:read"),
  getContractHandler,
);

contractRouter.patch(
  "/:id",
  requirePermission("contract:update"),
  updateContractHandler,
);

contractRouter.delete(
  "/:id",
  requirePermission("contract:delete"),
  deleteContractHandler,
);
