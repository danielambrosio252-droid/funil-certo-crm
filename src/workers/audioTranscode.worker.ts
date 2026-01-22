/* eslint-disable no-restricted-globals */
/**
 * FFmpeg Web Worker (Vite `?worker` entry)
 * Converts recorded audio -> OGG + Opus (audio/ogg)
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { isLikelyOggOpus } from "./oggUtils";

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
      // CDN fallback (some networks throttle/block a specific CDN)
      const baseURLs = [
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm",
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm",
      ];

      let lastError: any = null;
      for (const baseURL of baseURLs) {
        try {
          post({ type: "progress", message: `[FFMPEG] downloading from: ${baseURL}` });

          const coreURL = await withTimeout(
            toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            120_000,
            "ffmpeg coreURL download"
          );
          const wasmURL = await withTimeout(
            toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
            240_000,
            "ffmpeg wasmURL download"
          );
          // Some devices take a while to initialize WASM; be generous.
          await withTimeout(ffmpeg.load({ coreURL, wasmURL }), 180_000, "ffmpeg.load");
          post({ type: "progress", message: "[FFMPEG] ready!" });
          return;
        } catch (e: any) {
          lastError = e;
          post({
            type: "progress",
            message: `[FFMPEG] failed from ${baseURL}: ${e?.message || String(e)}`,
          });
        }
      }

      throw lastError || new Error("FFmpeg load failed (all CDNs)");
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

  post({ type: "progress", message: "[FFMPEG] exec -> ogg/opus (Meta scrutiny safe)" });

  // We do 2-pass preset fallback. Meta may accept upload but later reject on scrutiny;
  // these presets aim to match WhatsApp voice note constraints.
  const presets = [
    {
      label: "whatsapp_voice_16k_cbr",
      args: [
        "-i",
        inputName,
        "-vn",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "libopus",
        "-b:a",
        "24k",
        "-vbr",
        "off",
        "-compression_level",
        "10",
        "-frame_duration",
        "20",
        "-application",
        "voip",
        "-f",
        "ogg",
        outputName,
      ],
    },
    {
      label: "opus_standard_48k_cbr",
      args: [
        "-i",
        inputName,
        "-vn",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-ac",
        "1",
        "-ar",
        "48000",
        "-c:a",
        "libopus",
        "-b:a",
        "32k",
        "-vbr",
        "off",
        "-compression_level",
        "10",
        "-frame_duration",
        "20",
        "-application",
        "voip",
        "-f",
        "ogg",
        outputName,
      ],
    },
  ];

  let out: Uint8Array | null = null;
  let lastPresetError: any = null;
  for (const preset of presets) {
    try {
      post({
        type: "progress",
        message: `[FFMPEG] preset=${preset.label}`,
      });

      await ffmpeg.exec(preset.args);

      post({ type: "progress", message: `[FFMPEG] readFile ${outputName}` });
      const candidate = await ffmpeg.readFile(outputName);

      const size = candidate?.length ?? 0;
      post({ type: "progress", message: `[FFMPEG] output size_bytes=${size}` });
      if (size < 1024) {
        throw new Error(`FFmpeg output too small: ${size} bytes`);
      }

      if (!isLikelyOggOpus(candidate)) {
        throw new Error("Output is not OGG/Opus (missing OpusHead)");
      }

      out = candidate;
      break;
    } catch (e: any) {
      lastPresetError = e;
      post({
        type: "progress",
        message: `[FFMPEG] preset failed (${preset.label}): ${e?.message || String(e)}`,
      });
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore
      }
    }
  }

  if (!out) {
    throw lastPresetError || new Error("FFmpeg transcode failed (all presets)");
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
