import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { parseOrThrow } from "../lib/validate";
import { TokenPayload } from "../types/user";
import {
  createAllocationSchema,
  createRequestSchema,
  createTypeSchema,
  decisionSchema,
  idParamSchema,
  updateAllocationSchema,
  updateRequestSchema,
  updateTypeSchema,
} from "../types/time-off.dto";
import {
  approveAllocation,
  approveRequest,
  cancelRequest,
  createAllocation,
  createRequest,
  createType,
  getAllocation,
  getRequest,
  getTimeOffSnapshot,
  getType,
  listAllocations,
  listMyAllocations,
  listMyRequests,
  listRequests,
  listTypes,
  refuseAllocation,
  refuseRequest,
  removeAllocation,
  removeRequest,
  removeType,
  updateAllocation,
  updateRequest,
  updateType,
} from "../services/time-off.service";

function requireUserId(req: Request): string {
  return requireActor(req).userId;
}

function requireActor(req: Request): TokenPayload {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  return req.user;
}

export async function getTimeOffSnapshotHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const snapshot = await getTimeOffSnapshot();

  res.status(200).json({
    success: true,
    data: snapshot,
  });
}

export async function listTypesHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const types = await listTypes();

  res.status(200).json({
    success: true,
    data: { types },
  });
}

export async function createTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createTypeSchema, req.body);
  const type = await createType(input);

  res.status(201).json({
    success: true,
    data: type,
  });
}

export async function getTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const type = await getType(id);

  res.status(200).json({
    success: true,
    data: type,
  });
}

export async function updateTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const input = parseOrThrow(updateTypeSchema, req.body);
  const type = await updateType(id, input);

  res.status(200).json({
    success: true,
    data: type,
  });
}

export async function deleteTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const deletedId = await removeType(id);

  res.status(200).json({
    success: true,
    data: { id: deletedId },
  });
}

export async function listAllocationsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const allocations = await listAllocations();

  res.status(200).json({
    success: true,
    data: { allocations },
  });
}

export async function listMyAllocationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const allocations = await listMyAllocations(requireUserId(req));

  res.status(200).json({
    success: true,
    data: { allocations },
  });
}

export async function createAllocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createAllocationSchema, req.body);
  const allocation = await createAllocation(input, requireUserId(req));

  res.status(201).json({
    success: true,
    data: allocation,
  });
}

export async function getAllocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const allocation = await getAllocation(id);

  res.status(200).json({
    success: true,
    data: allocation,
  });
}

export async function updateAllocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const input = parseOrThrow(updateAllocationSchema, req.body);
  const allocation = await updateAllocation(id, input, requireUserId(req));

  res.status(200).json({
    success: true,
    data: allocation,
  });
}

export async function approveAllocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const allocation = await approveAllocation(id, requireUserId(req));

  res.status(200).json({
    success: true,
    data: allocation,
  });
}

export async function refuseAllocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const { reason } = parseOrThrow(decisionSchema, req.body);
  const allocation = await refuseAllocation(id, reason, requireUserId(req));

  res.status(200).json({
    success: true,
    data: allocation,
  });
}

export async function deleteAllocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const deletedId = await removeAllocation(id);

  res.status(200).json({
    success: true,
    data: { id: deletedId },
  });
}

export async function listRequestsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const requests = await listRequests();

  res.status(200).json({
    success: true,
    data: { requests },
  });
}

export async function listMyRequestsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const requests = await listMyRequests(requireUserId(req));

  res.status(200).json({
    success: true,
    data: { requests },
  });
}

export async function createRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createRequestSchema, req.body);
  const request = await createRequest(input, requireActor(req));

  res.status(201).json({
    success: true,
    data: request,
  });
}

export async function getRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const request = await getRequest(id);

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function updateRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const input = parseOrThrow(updateRequestSchema, req.body);
  const request = await updateRequest(id, input, requireUserId(req));

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function approveRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const request = await approveRequest(id, requireUserId(req));

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function refuseRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const { reason } = parseOrThrow(decisionSchema, req.body);
  const request = await refuseRequest(id, reason, requireUserId(req));

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function cancelRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const { reason } = parseOrThrow(decisionSchema, req.body);
  const request = await cancelRequest(id, reason, requireUserId(req));

  res.status(200).json({
    success: true,
    data: request,
  });
}

export async function deleteRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const deletedId = await removeRequest(id);

  res.status(200).json({
    success: true,
    data: { id: deletedId },
  });
}
