import path from "node:path";
import sharp, { type OutputInfo } from "sharp";
import { AppError } from "../errors/AppError";
import { assertIsSupportedImage } from "./imageValidation";

type FaceApi = typeof import("@vladmandic/face-api");
export interface FaceDescription {
  descriptor: number[];
  detectionScore: number;
}

// A single warm WASM engine avoids repeatedly loading weights and competing for
// CPU. The bounded queue also limits retained uploads during check-in bursts.
const MAX_QUEUE = 8;
const QUEUE_TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
let busy = false;
const waiting: Array<() => void> = [];
let enginePromise: Promise<FaceApi> | undefined;

async function acquire(): Promise<() => void> {
  if (busy) {
    if (waiting.length >= MAX_QUEUE) {
      throw new AppError(429, "Face verification is busy. Please try again shortly.", "FACE_SERVICE_BUSY");
    }
    await new Promise<void>((resolve, reject) => {
      const proceed = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        const index = waiting.indexOf(proceed);
        if (index !== -1) waiting.splice(index, 1);
        reject(new AppError(503, "Face verification is busy. Please try again shortly.", "FACE_SERVICE_BUSY"));
      }, QUEUE_TIMEOUT_MS);
      waiting.push(proceed);
    });
  } else {
    busy = true;
  }
  return () => {
    const next = waiting.shift();
    if (next) next();
    else busy = false;
  };
}

function getEngine(): Promise<FaceApi> {
  enginePromise ??= (async () => {
    // The default package entry requires native tfjs-node; this entry uses the
    // portable WASM backend and works on Apple Silicon and Linux without it.
    const tf: typeof import("@tensorflow/tfjs") = require("@tensorflow/tfjs");
    const wasm: typeof import("@tensorflow/tfjs-backend-wasm") = require("@tensorflow/tfjs-backend-wasm");
    const faceapi: FaceApi = require("@vladmandic/face-api/dist/face-api.node-wasm.js");
    wasm.setWasmPaths(`${path.dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json"))}/dist/`);
    wasm.setThreadsCount(1);
    if (!await tf.setBackend("wasm")) throw new Error("WASM backend is unavailable");
    await tf.ready();
    const modelDirectory = process.env.FACE_MODELS_DIR ||
      path.join(path.dirname(require.resolve("@vladmandic/face-api/package.json")), "model");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDirectory),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelDirectory),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelDirectory),
    ]);
    return faceapi;
  })().catch((cause: unknown) => {
    // A missing model/deployment issue must not poison the process permanently.
    enginePromise = undefined;
    const error = new AppError(503, "Face verification is unavailable. Please try again later.", "FACE_SERVICE_UNAVAILABLE");
    error.cause = cause;
    throw error;
  });
  return enginePromise;
}

/** Optional startup warm-up; failures must not prevent unrelated APIs starting. */
export async function warmFaceEngine(): Promise<void> {
  await getEngine();
}

/** One face only. This is face matching, not anti-spoofing or liveness detection. */
export async function describeFace(image: Buffer): Promise<FaceDescription> {
  if (!Buffer.isBuffer(image) || image.length > MAX_IMAGE_BYTES) {
    throw new AppError(400, "Upload a selfie smaller than 10 MB", "FACE_IMAGE_INVALID");
  }
  assertIsSupportedImage(image, "selfie");
  const release = await acquire();
  try {
    let decoded: { data: Buffer; info: OutputInfo };
    try {
      const input = sharp(image, { limitInputPixels: 20_000_000, failOn: "warning" });
      const metadata = await input.metadata();
      if ((metadata.pages ?? 1) !== 1) throw new Error("Animated images are not supported");
      decoded = await input.rotate().resize(640, 640, { fit: "inside", withoutEnlargement: true })
        .toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
    } catch {
      throw new AppError(400, "The selfie could not be read. Take a new JPEG, PNG or WebP photo.", "FACE_IMAGE_INVALID");
    }
    const { data, info } = decoded;
    if (Math.min(info.width, info.height) < 160) {
      throw new AppError(400, "The selfie is too small. Please take a clearer photo.", "FACE_IMAGE_INVALID");
    }
    const faceapi = await getEngine();
    const tensor = faceapi.tf.tensor3d(new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      [info.height, info.width, 3], "int32");
    try {
      const results = await faceapi.detectAllFaces(tensor,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6, maxResults: 2 }))
        .withFaceLandmarks().withFaceDescriptors();
      if (results.length === 0) {
        throw new AppError(400, "No clear face detected. Face the camera in good lighting and try again.", "FACE_NOT_DETECTED");
      }
      if (results.length !== 1) {
        throw new AppError(400, "More than one face detected. Only you should be in the selfie.", "MULTIPLE_FACES");
      }
      const result = results[0]!;
      if (Math.min(result.detection.box.width, result.detection.box.height) < 80) {
        throw new AppError(400, "Move closer to the camera so your face is clearly visible.", "FACE_IMAGE_INVALID");
      }
      const descriptor = Array.from(result.descriptor);
      assertDescriptor(descriptor);
      return { descriptor, detectionScore: result.detection.score };
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      const error = new AppError(503, "Face verification failed. Please try again shortly.", "FACE_SERVICE_UNAVAILABLE");
      error.cause = cause;
      throw error;
    } finally {
      tensor.dispose();
    }
  } finally {
    release();
  }
}

function assertDescriptor(value: readonly number[]): void {
  if (value.length !== 128 || !value.every(Number.isFinite)) {
    throw new AppError(400, "The face template is invalid. Please enrol your face again.", "FACE_TEMPLATE_INVALID");
  }
}

/** Euclidean distance for this model's 128-dimensional embeddings (lower is better). */
export function faceDistance(a: readonly number[], b: readonly number[]): number {
  assertDescriptor(a);
  assertDescriptor(b);
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]!) ** 2, 0));
}
