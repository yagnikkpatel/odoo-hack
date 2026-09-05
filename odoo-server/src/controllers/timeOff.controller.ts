import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { parseOrThrow } from "../lib/validate";
import {
  approveTimeOffRequestSchema,
  createTimeOffRequestSchema,
  listTimeOffRequestsQuerySchema,
  myTimeOffRequestsQuerySchema,
  rejectTimeOffRequestSchema,
  timeOffIdParamSchema,
  updateTimeOffRequestSchema,
} from "../types/timeOff.dto";
import { TokenPayload } from "../types/user";
import {
  approveTimeOffRequest,
  createTimeOffRequest,
  getTimeOffRequest,
  listMyTimeOffRequests,
  listTimeOffRequests,
  rejectTimeOffRequest,
  removeTimeOffRequest,
  updateTimeOffRequest,
} from "../services/timeOff.service";

function requireActor(req: Request): TokenPayload {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

export async function createTimeOffRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createTimeOffRequestSchema, req.body);
  const request = await createTimeOffRequest(input, requireActor(req));

  res.status(201).json({
    success: true,
    data: request,
  });
}

export async function listTimeOffRequestsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listTimeOffRequestsQuerySchema, req.query);
  const result = await listTimeOffRequests(query);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function listMyTimeOffRequestsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(myTimeOffRequestsQuerySchema, req.query);
  const result = await listMyTimeOffRequests(requireActor(req).userId, query);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function getTimeOffRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(timeOffIdParamSchema, req.params);
  const request = await getTimeOffRequest(id, requireActor(req));

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function updateTimeOffRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(timeOffIdParamSchema, req.params);
  const input = parseOrThrow(updateTimeOffRequestSchema, req.body);
  const request = await updateTimeOffRequest(id, input);

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function approveTimeOffRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(timeOffIdParamSchema, req.params);
  const input = parseOrThrow(approveTimeOffRequestSchema, req.body ?? {});
  const request = await approveTimeOffRequest(id, input, requireActor(req));

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function rejectTimeOffRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(timeOffIdParamSchema, req.params);
  const input = parseOrThrow(rejectTimeOffRequestSchema, req.body);
  const request = await rejectTimeOffRequest(id, input, requireActor(req));

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function deleteTimeOffRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(timeOffIdParamSchema, req.params);
  const deletedId = await removeTimeOffRequest(id);

  res.status(200).json({
    success: true,
    data: { id: deletedId },
  });
}
