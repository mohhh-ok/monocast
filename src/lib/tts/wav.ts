/**
 * 16bit mono LE PCM の生バイト列に WAVE ヘッダを付ける。
 */
export function buildWavFromPcm(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono 16bit)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * WAV ヘッダから fmt チャンクを探してサンプルレートを読む。
 */
export function readWavSampleRate(wav: Buffer): number {
  let i = 12;
  while (i < wav.length - 8) {
    const id = wav.toString("ascii", i, i + 4);
    const size = wav.readUInt32LE(i + 4);
    if (id === "fmt ") {
      return wav.readUInt32LE(i + 12);
    }
    i += 8 + size + (size % 2);
  }
  throw new Error("WAV fmt chunk not found");
}

/**
 * 16bit mono LE PCM WAV の data チャンクに無音を追記する。
 * RIFF サイズと data チャンクサイズを書き換える。
 */
export function appendSilenceToWav(
  wav: Buffer,
  silenceSec: number,
  sampleRate: number,
): Buffer {
  if (silenceSec <= 0) return wav;
  let i = 12;
  while (i < wav.length - 8) {
    const id = wav.toString("ascii", i, i + 4);
    const rawSize = wav.readUInt32LE(i + 4);
    // Kokoro-FastAPI 等はストリーミング時に RIFF/data の size を
    // 0xFFFFFFFF のままにする場合がある。実バッファ長を超えるなら実長で再計算する。
    const remaining = wav.length - (i + 8);
    const size = rawSize > remaining ? remaining : rawSize;
    if (id === "data") {
      const silenceBytes = Math.round(silenceSec * sampleRate) * 2;
      const silence = Buffer.alloc(silenceBytes);
      const head = wav.subarray(0, i + 8);
      const data = wav.subarray(i + 8, i + 8 + size);
      const tail = wav.subarray(i + 8 + size);
      const out = Buffer.concat([head, data, silence, tail]);
      out.writeUInt32LE(size + silenceBytes, i + 4);
      out.writeUInt32LE(out.length - 8, 4);
      return out;
    }
    i += 8 + size + (size % 2);
  }
  throw new Error("WAV data chunk not found");
}
