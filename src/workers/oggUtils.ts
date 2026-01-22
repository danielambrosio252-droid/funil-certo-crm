/**
 * OGG helpers
 * Lightweight validation to avoid sending invalid/unsupported audio to Meta.
 */

/**
 * Returns true if the buffer looks like an OGG container that contains an Opus stream.
 * This is a heuristic: we check the OggS capture pattern and the OpusHead marker.
 */
export function isLikelyOggOpus(data: Uint8Array): boolean {
  if (!data || data.length < 64) return false;

  // OggS capture pattern at offset 0
  if (data[0] !== 0x4f || data[1] !== 0x67 || data[2] !== 0x67 || data[3] !== 0x53) {
    return false;
  }

  // Search for OpusHead in the first ~64KB (should be very early)
  const needle = [
    0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, // "OpusHead"
  ];
  const limit = Math.min(data.length, 64 * 1024);

  outer: for (let i = 0; i <= limit - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (data[i + j] !== needle[j]) continue outer;
    }
    return true;
  }

  return false;
}
