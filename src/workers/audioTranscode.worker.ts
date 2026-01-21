/* eslint-disable no-restricted-globals */
/**
 * FFmpeg Web Worker (Vite `?worker` entry)
 * Converts recorded audio -> OGG + Opus (audio/ogg)
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

type WorkerSelf = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((this: unknown, ev: MessageEvent<any>) => any) | null;
};

// In Vite TS builds, `self` may be typed as Window (postMessage requires targetOrigin).
// Force worker-appropriate typing.
const ctx = self as unknown as WorkerSelf;

let ffmpeg = null;
let loading = null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

function post(msg: unknown, transfer?: Transferable[]) {
  ctx.postMessage(msg, transfer);
}

async function ensureLoaded() {
  if (ffmpeg) return;
  if (loading) return loading;

  ffmpeg = new FFmpeg();
  loading = (async () => {
    try {
      // Use jsDelivr CDN which is faster and more reliable
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
      post({ type: "progress", message: "[FFMPEG] downloading from CDN..." });

      const coreURL = await withTimeout(
        toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        60_000,
        "ffmpeg coreURL download"
      );
      const wasmURL = await withTimeout(
        toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        180_000,
        "ffmpeg wasmURL download"
      );
      await withTimeout(ffmpeg.load({ coreURL, wasmURL }), 90_000, "ffmpeg.load");
      post({ type: "progress", message: "[FFMPEG] ready!" });
    } catch (e: any) {
      const msg = e?.message || String(e);
      post({ type: "error", error: `[FFMPEG] load failed: ${msg}` });
      // Reset state to allow retry
      ffmpeg = null;
      loading = null;
      throw e;
    }
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
  // WhatsApp voice-note compatibility baseline (market-standard settings):
  // - mono (ac=1)
  // - 48kHz (ar=48000)
  // - opus codec (libopus)
  // - low bitrate (16k-32k) + application=voip
  // - OGG container
  post({
    type: "progress",
    message:
      "[FFMPEG] params: codec=libopus container=ogg ac=1 ar=48000 b=24k application=voip",
  });
  await ffmpeg.exec([
    "-i",
    inputName,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "libopus",
    "-b:a",
    "24k",
    "-application",
    "voip",
    "-f",
    "ogg",
    outputName,
  ]);

  post({ type: "progress", message: `[FFMPEG] readFile ${outputName}` });
  const out = await ffmpeg.readFile(outputName);

  // Quick sanity check: WhatsApp silently rejects some invalid OGGs.
  // We'll fail-fast if the output is suspiciously tiny.
  const outSize = out?.length ?? 0;
  post({ type: "progress", message: `[FFMPEG] output size_bytes=${outSize}` });
  if (outSize < 1024) {
    post({ type: "error", error: `[FFMPEG] output too small (<1KB): ${outSize} bytes` });
    throw new Error(`FFmpeg output too small: ${outSize} bytes`);
  }

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

    // Explicit preload hook: loads FFmpeg core/WASM without attempting a transcode.
    if (msg.type === "preload") {
      await ensureLoaded();
      post({ type: "progress", message: "[FFMPEG] ready!" });
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
