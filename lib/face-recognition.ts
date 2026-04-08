"use client";

import * as faceapi from "@vladmandic/face-api";

let modelsLoaded = false;
let modelLoadPromise: Promise<void> | null = null;

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return modelLoadPromise;
}

export async function detectFaceDescriptor(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  await loadFaceApiModels();
  const detection = await faceapi
    .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return detection.descriptor;
}

export function compareFaceDescriptors(
  desc1: number[] | Float32Array,
  desc2: number[] | Float32Array
): number {
  const a = desc1 instanceof Float32Array ? desc1 : new Float32Array(desc1);
  const b = desc2 instanceof Float32Array ? desc2 : new Float32Array(desc2);
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  const distance = Math.sqrt(sum);
  return Math.max(0, 1 - distance);
}

export type FaceMatchResult = {
  userId: string;
  userName: string;
  confidence: number;
};

export function findBestMatch(
  descriptor: Float32Array | number[],
  candidates: Array<{ userId: string; userName: string; faceDescriptor: number[] }>
): FaceMatchResult | null {
  let best: FaceMatchResult | null = null;
  for (const c of candidates) {
    const conf = compareFaceDescriptors(descriptor, c.faceDescriptor);
    if (!best || conf > best.confidence) {
      best = { userId: c.userId, userName: c.userName, confidence: conf };
    }
  }
  return best;
}
