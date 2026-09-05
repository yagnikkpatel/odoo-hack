import { Router } from "express";
import { queryRecord, uuidParam } from "../lib/http";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import * as scheduleService from "../services/schedule.service";

export const scheduleRouter = Router();

scheduleRouter.use(authenticate);

const read = requirePermission("schedule.read");
const write = requirePermission("schedule.write");

scheduleRouter.get("/", read, async (req, res, next) => {
  try {
    const { rows, meta } = await scheduleService.list(queryRecord(req));

    res.status(200).json({ success: true, data: rows, meta });
  } catch (err) {
    next(err);
  }
});

scheduleRouter.post("/", write, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await scheduleService.create(req.body) });
  } catch (err) {
    next(err);
  }
});

scheduleRouter.get("/:scheduleId", read, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await scheduleService.getById(uuidParam(req, "scheduleId")),
    });
  } catch (err) {
    next(err);
  }
});

scheduleRouter.patch("/:scheduleId", write, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await scheduleService.update(uuidParam(req, "scheduleId"), req.body),
    });
  } catch (err) {
    next(err);
  }
});

scheduleRouter.delete("/:scheduleId", write, async (req, res, next) => {
  try {
    await scheduleService.archive(uuidParam(req, "scheduleId"));

    res.status(200).json({ success: true, message: "Working schedule archived." });
  } catch (err) {
    next(err);
  }
});
