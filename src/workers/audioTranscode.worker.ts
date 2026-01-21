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

  post({ type: "progress", message: "[FFMPEG] exec -> ogg/opus (WhatsApp optimized)" });
  // WhatsApp voice-note compatibility settings (VERIFIED working):
  // - mono (ac=1)
  // - 16kHz (ar=16000) - WhatsApp standard for voice notes
  // - opus codec (libopus)
  // - 24k bitrate
  // - OGG container with proper headers
  post({
    type: "progress",
    message:
      "[FFMPEG] params: codec=libopus container=ogg ac=1 ar=16000 b:a=24k",
  });
  await ffmpeg.exec([
    "-i",
    inputName,
    "-vn",              // No video
    "-ac",
    "1",                // Mono
    "-ar",
    "16000",            // 16kHz - WhatsApp voice note standard
    "-c:a",
    "libopus",          // Opus codec
    "-b:a",
    "24k",              // 24kbps bitrate
    "-vbr",
    "on",               // Variable bitrate
    "-compression_level",
    "10",               // Maximum compression
    "-frame_duration",
    "20",               // 20ms frames (WhatsApp standard)
    "-application",
    "voip",             // Voice-note oriented Opus tuning (improves Meta compatibility)
    "-f",
    "ogg",              // Force OGG container explicitly (avoid ambiguous muxing)
    outputName,         // Output file (extension determines container)
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
