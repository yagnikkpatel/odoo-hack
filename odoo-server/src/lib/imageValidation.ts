import { AppError } from "../errors/AppError";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.subarray(0, 3).equals(JPEG_SIGNATURE);
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function assertIsSupportedImage(buffer: Buffer, field: string): void {
  if (buffer.length === 0) {
    throw new AppError(400, `Uploaded file for "${field}" is empty`);
  }

  if (isPng(buffer) || isJpeg(buffer) || isWebp(buffer)) {
    return;
  }

  throw new AppError(
    400,
    `Uploaded file for "${field}" is not a valid jpeg, png or webp image`,
  );
}
