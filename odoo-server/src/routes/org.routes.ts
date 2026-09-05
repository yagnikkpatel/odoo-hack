import { Router } from "express";
import { queryRecord, uuidParam } from "../lib/http";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import * as orgService from "../services/org.service";

export const orgRouter = Router();

// This router owns three different prefixes, so it cannot be mounted under one. That rules
// out a router-wide `authenticate` — mounted bare it would catch every unmatched path and
// answer 401 where the API should answer 404. Each route carries its own guard chain instead.
const read = [authenticate, requirePermission("employee.read")];
const write = [authenticate, requirePermission("employee.write")];
const remove = [authenticate, requirePermission("employee.delete")];
const configWrite = [authenticate, requirePermission("config.write")];

orgRouter.get("/departments", ...read, async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await orgService.listDepartments(queryRecord(req)) });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/departments", ...write, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await orgService.createDepartment(req.body) });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/departments/:departmentId", ...write, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await orgService.updateDepartment(uuidParam(req, "departmentId"), req.body),
    });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/departments/:departmentId", ...remove, async (req, res, next) => {
  try {
    await orgService.archiveDepartment(uuidParam(req, "departmentId"));

    res.status(200).json({ success: true, message: "Department archived." });
  } catch (err) {
    next(err);
  }
});

orgRouter.get("/job-positions", ...read, async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await orgService.listJobPositions(queryRecord(req)) });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/job-positions", ...write, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await orgService.createJobPosition(req.body) });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/job-positions/:jobPositionId", ...write, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await orgService.updateJobPosition(uuidParam(req, "jobPositionId"), req.body),
    });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/job-positions/:jobPositionId", ...remove, async (req, res, next) => {
  try {
    await orgService.archiveJobPosition(uuidParam(req, "jobPositionId"));

    res.status(200).json({ success: true, message: "Job position archived." });
  } catch (err) {
    next(err);
  }
});

orgRouter.get("/employment-types", ...read, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await orgService.listEmploymentTypes(queryRecord(req)),
    });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/employment-types", ...configWrite, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await orgService.createEmploymentType(req.body) });
  } catch (err) {
    next(err);
  }
});
