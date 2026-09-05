import { Router } from "express";
import { queryRecord, uuidParam } from "../lib/http";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import * as contractService from "../services/contract.service";

export const contractRouter = Router();

contractRouter.use(authenticate);

const read = requirePermission("contract.read");
const write = requirePermission("contract.write");
const remove = requirePermission("contract.delete");

// Declared before "/:contractId" so the literal path is not swallowed by the parameter.
contractRouter.get("/applicable", read, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await contractService.findApplicable(queryRecord(req)),
    });
  } catch (err) {
    next(err);
  }
});

contractRouter.get("/", read, async (req, res, next) => {
  try {
    const { rows, meta } = await contractService.list(queryRecord(req));

    res.status(200).json({ success: true, data: rows, meta });
  } catch (err) {
    next(err);
  }
});

contractRouter.post("/", write, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await contractService.create(req.body) });
  } catch (err) {
    next(err);
  }
});

contractRouter.get("/:contractId", read, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await contractService.getById(uuidParam(req, "contractId")),
    });
  } catch (err) {
    next(err);
  }
});

contractRouter.patch("/:contractId", write, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await contractService.update(uuidParam(req, "contractId"), req.body),
    });
  } catch (err) {
    next(err);
  }
});

contractRouter.delete("/:contractId", remove, async (req, res, next) => {
  try {
    await contractService.remove(uuidParam(req, "contractId"));

    res.status(200).json({ success: true, message: "Contract deleted." });
  } catch (err) {
    next(err);
  }
});

contractRouter.post("/:contractId/activate", write, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await contractService.activate(uuidParam(req, "contractId")),
    });
  } catch (err) {
    next(err);
  }
});

contractRouter.post("/:contractId/cancel", write, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await contractService.cancel(uuidParam(req, "contractId")),
    });
  } catch (err) {
    next(err);
  }
});
