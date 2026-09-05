import { NextFunction, Request, Response, Router } from "express";
import { queryRecord, uuidParam } from "../lib/http";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import { AppError } from "../errors/AppError";
import { enqueueImageDeletion } from "../queues/deleteCloudinaryImage.queue";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission, scopeToSelf } from "../middlewares/permission.middleware";
import { handleUploadErrors, uploadImage } from "../middlewares/upload.middleware";
import * as employeeService from "../services/employee.service";

export const employeeRouter = Router();

employeeRouter.use(authenticate);

const read = requirePermission("employee.read", "employee.read_self");
const write = requirePermission("employee.write");
const remove = requirePermission("employee.delete");

/**
 * BR-RBAC-2 / BR-RBAC-7: a caller without the broad `employee.read` is pinned to their own
 * record, and only a caller who can run payroll sees an unmasked bank account.
 */
function scope(req: Request): { onlyId: string | null; unmasked: boolean } {
  return {
    onlyId: scopeToSelf(req, "employee.read"),
    unmasked: req.permissions?.has("payrun.write") ?? false,
  };
}

employeeRouter.get("/", read, async (req, res, next) => {
  try {
    const { rows, meta } = await employeeService.list(queryRecord(req), scope(req));

    res.status(200).json({ success: true, data: rows, meta });
  } catch (err) {
    next(err);
  }
});

employeeRouter.post("/", write, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await employeeService.create(req.body) });
  } catch (err) {
    next(err);
  }
});

employeeRouter.get("/:employeeId", read, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await employeeService.getById(uuidParam(req, "employeeId"), scope(req)),
    });
  } catch (err) {
    next(err);
  }
});

employeeRouter.patch("/:employeeId", write, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await employeeService.update(uuidParam(req, "employeeId"), req.body),
    });
  } catch (err) {
    next(err);
  }
});

employeeRouter.delete("/:employeeId", remove, async (req, res, next) => {
  try {
    await employeeService.terminate(uuidParam(req, "employeeId"), req.body);

    res.status(200).json({ success: true, message: "Employee terminated." });
  } catch (err) {
    next(err);
  }
});

employeeRouter.get("/:employeeId/summary", read, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await employeeService.getSummary(uuidParam(req, "employeeId"), {
        onlyId: scopeToSelf(req, "employee.read"),
      }),
    });
  } catch (err) {
    next(err);
  }
});

employeeRouter.post(
  "/:employeeId/photo",
  write,
  (req: Request, res: Response, next: NextFunction) => {
    uploadImage(req, res, (error) => {
      if (error) {
        try {
          handleUploadErrors(error);
        } catch (translated) {
          next(translated);
        }

        return;
      }

      next();
    });
  },
  async (req, res, next) => {
    try {
      const employeeId = uuidParam(req, "employeeId");

      if (!req.file) {
        throw new AppError(400, "No image was uploaded.", "validation_error", [
          { field: "file", message: "required" },
        ]);
      }

      const uploaded = await uploadImageToCloudinary(req.file.buffer, {
        folder: "peoplepay360/employees",
      });

      const { previousPublicId } = await employeeService.setPhoto(employeeId, {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
      });

      if (previousPublicId) {
        await enqueueImageDeletion(previousPublicId);
      }

      res.status(200).json({ success: true, data: { photo_url: uploaded.secureUrl } });
    } catch (err) {
      next(err);
    }
  },
);
