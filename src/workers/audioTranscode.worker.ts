/* eslint-disable no-restricted-globals */
/**
 * FFmpeg Web Worker (Vite `?worker` entry)
 * Converts recorded audio -> OGG + Opus (audio/ogg)
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";

type WorkerSelf = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((this: unknown, ev: MessageEvent<any>) => any) | null;
};

// In Vite TS builds, `self` may be typed as Window (postMessage requires targetOrigin).
// Force worker-appropriate typing.
const ctx = self as unknown as WorkerSelf;

let ffmpeg = null;
let loading = null;

function post(msg: unknown, transfer?: Transferable[]) {
  ctx.postMessage(msg, transfer);
}

async function ensureLoaded() {
  if (ffmpeg) return;
  if (loading) return loading;

  ffmpeg = new FFmpeg();
  loading = (async () => {
    post({ type: "progress", message: "[FFMPEG] loading" });
    await ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
    });
    post({ type: "progress", message: "[FFMPEG] loaded" });
  })();

  return loading;
}

function inputExtFromMime(mime) {
  const mt = (mime || "").toLowerCase();
  if (mt.includes("webm")) return "webm";
  if (mt.includes("mp4") || mt.includes("m4a")) return "mp4";
  if (mt.includes("ogg")) return "ogg";
  if (mt.includes("wav")) return "wav";
  return "webm";
}

async function transcode(inputArrayBuffer, originalMimeType) {
  await ensureLoaded();

  const inputExt = inputExtFromMime(originalMimeType);
  const inputName = `input.${inputExt}`;
  const outputName = "output.ogg";

  post({ type: "progress", message: `[FFMPEG] writeFile ${inputName}` });
  await ffmpeg.writeFile(inputName, new Uint8Array(inputArrayBuffer));

  post({ type: "progress", message: "[FFMPEG] exec -> ogg/opus" });
  await ffmpeg.exec([
    "-i",
    inputName,
    "-c:a",
    "libopus",
    "-b:a",
    "64k",
    "-vn",
    "-ar",
    "48000",
    outputName,
  ]);

  post({ type: "progress", message: `[FFMPEG] readFile ${outputName}` });
  const out = await ffmpeg.readFile(outputName);

  // cleanup
  try {
    await ffmpeg.deleteFile(inputName);
  } catch {
    // ignore
  }
  try {
    await ffmpeg.deleteFile(outputName);
  } catch {
    // ignore
  }

  const oggArrayBuffer = out.slice().buffer;
  post({ type: "result", oggArrayBuffer }, [oggArrayBuffer]);
}

ctx.onmessage = async (evt) => {
  try {
    const msg = evt.data;
    if (!msg) return;

    if (msg.type === "ping") {
      post({ type: "progress", message: "pong" });
      return;
    }

    if (msg.type === "transcode") {
      await transcode(msg.inputArrayBuffer, msg.originalMimeType);
      return;
    }

    post({ type: "error", error: "Unknown message type" });
  } catch (e) {
    post({ type: "error", error: e?.message || String(e) });
  }
};
