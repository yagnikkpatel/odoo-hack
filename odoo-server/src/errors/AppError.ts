export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: { field: string; message: string }[];

  constructor(
    statusCode: number,
    message: string,
    code = "error",
    details?: { field: string; message: string }[],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
