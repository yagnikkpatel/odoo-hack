import { Request, Response } from "express";
import { parseOrThrow } from "../lib/validate";
import {
  contractIdParamSchema,
  createContractSchema,
  listContractsQuerySchema,
  updateContractSchema,
} from "../types/contract.dto";
import {
  createContract,
  getContract,
  listContracts,
  removeContract,
  updateContract,
} from "../services/contract.service";

export async function createContractHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseOrThrow(createContractSchema, req.body);
  const contract = await createContract(input);

  res.status(201).json({
    success: true,
    data: contract,
  });
}

export async function listContractsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseOrThrow(listContractsQuerySchema, req.query);
  const result = await listContracts(query);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function getContractHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(contractIdParamSchema, req.params);
  const contract = await getContract(id);

  res.status(200).json({
    success: true,
    data: contract,
  });
}

export async function updateContractHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(contractIdParamSchema, req.params);
  const input = parseOrThrow(updateContractSchema, req.body);
  const contract = await updateContract(id, input);

  res.status(200).json({
    success: true,
    data: contract,
  });
}

export async function deleteContractHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseOrThrow(contractIdParamSchema, req.params);
  const deletedId = await removeContract(id);

  res.status(200).json({
    success: true,
    data: { id: deletedId },
  });
}
