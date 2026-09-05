import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { describeFace, faceDistance } from "../lib/face";
import { distanceBetween, formatDistance } from "../lib/geo";
import { AppError } from "../errors/AppError";

async function main() {
  const zeros = Array<number>(128).fill(0);
  const other = [...zeros];
  other[0] = 0.3;
  other[1] = 0.4;
  assert.equal(faceDistance(zeros, zeros), 0);
  assert.equal(faceDistance(zeros, other), 0.5);
  assert.throws(() => faceDistance([], zeros), AppError);
  assert.throws(() => faceDistance(Array(128).fill(NaN), zeros), AppError);
  assert.equal(distanceBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(Math.abs(distanceBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111_195) < 1);
  assert.ok(distanceBetween({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }) < 223);
  assert.ok(Number.isFinite(distanceBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })));
  assert.throws(() => distanceBetween({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 }), AppError);
  assert.throws(() => distanceBetween({ latitude: 0, longitude: NaN }, { latitude: 0, longitude: 0 }), AppError);
  assert.equal(formatDistance(150), "150 m");
  assert.equal(formatDistance(1500), "1.5 km");
  await assert.rejects(describeFace(Buffer.from("not an image")), /not a valid/);
  const tiny = await sharp({ create: { width: 32, height: 32, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(describeFace(tiny), /too small/);
  const blank = await sharp({ create: { width: 640, height: 480, channels: 3, background: "white" } }).png().toBuffer();
  const coldStart = performance.now();
  await assert.rejects(describeFace(blank), /No clear face detected/);
  const coldMs = Math.round(performance.now() - coldStart);
  const warmStart = performance.now();
  await assert.rejects(describeFace(blank), /No clear face detected/);
  const warmMs = Math.round(performance.now() - warmStart);
  const tf: typeof import("@tensorflow/tfjs") = require("@tensorflow/tfjs");
  const tensorsBefore = tf.memory().numTensors;
  const burst = await Promise.allSettled(Array.from({ length: 10 }, () => describeFace(blank)));
  assert.equal(burst.filter(result => result.status === "rejected" &&
    result.reason instanceof AppError && result.reason.statusCode === 429).length, 1);
  assert.ok(burst.every(result => result.status === "rejected"));
  assert.equal(tf.memory().numTensors, tensorsBefore, "Inference tensors must be released after each request");
  console.log({ checks: "passed", blankColdMs: coldMs, blankWarmMs: warmMs });
  // Optional consenting user's local test photo; never downloads or logs biometric vectors.
  // A single fixture only checks extraction/repeatability, not matching accuracy or liveness.
  const fixturePath = process.argv[2];
  if (fixturePath) {
    const fixture = await readFile(fixturePath);
    const firstStart = performance.now();
    const first = await describeFace(fixture);
    const firstMs = Math.round(performance.now() - firstStart);
    const secondStart = performance.now();
    const second = await describeFace(fixture);
    console.log({ fixtureMs: firstMs, repeatMs: Math.round(performance.now() - secondStart),
      detectionScore: first.detectionScore, repeatDistance: faceDistance(first.descriptor, second.descriptor) });
    assert.ok(faceDistance(first.descriptor, second.descriptor) < 0.001);
  } else {
    console.log("No real-face fixture supplied; identity accuracy, pose, and multiple-person detection are not benchmarked.");
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
