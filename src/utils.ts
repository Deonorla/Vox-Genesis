/**
 * Converts a base64 encoded audio string into a playable blob URL.
 * Automatically wraps raw 24kHz mono 16-bit PCM with a WAV header if needed,
 * or serves WAV/MP3 container audio directly.
 */
export function getAudioUrlFromBase64(base64: string): string {
  const binaryString = window.atob(base64);
  
  // Check if it already has a header (e.g., RIFF for WAV, ID3/MPEG for MP3/AAC)
  const isWav = binaryString.startsWith('RIFF');
  const isMp3 = binaryString.startsWith('ID3') || 
                binaryString.startsWith('\xFF\xFB') || 
                binaryString.startsWith('\xFF\xF3') || 
                binaryString.startsWith('\xFF\xF2');
  
  if (isWav) {
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } else if (isMp3) {
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mp3' });
    return URL.createObjectURL(blob);
  }

  // Otherwise, assume raw 24kHz mono 16-bit PCM and wrap it in a WAV header
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  // Chunk ID "RIFF"
  view.setUint8(0, 0x52); 
  view.setUint8(1, 0x49); 
  view.setUint8(2, 0x46); 
  view.setUint8(3, 0x46);
  
  // Chunk Size
  view.setUint32(4, 36 + len, true);
  
  // Format "WAVE"
  view.setUint8(8, 0x57); 
  view.setUint8(9, 0x41); 
  view.setUint8(10, 0x56); 
  view.setUint8(11, 0x45);
  
  // Subchunk1 ID "fmt "
  view.setUint8(12, 0x66); 
  view.setUint8(13, 0x6d); 
  view.setUint8(14, 0x74); 
  view.setUint8(15, 0x20);
  
  // Subchunk1 Size (16 for PCM)
  view.setUint32(16, 16, true);
  
  // Audio Format (1 for PCM)
  view.setUint16(20, 1, true);
  
  // Num Channels (1 for Mono)
  view.setUint16(22, 1, true);
  
  // Sample Rate (24000 Hz)
  view.setUint32(24, 24000, true);
  
  // Byte Rate (SampleRate * NumChannels * BitsPerSample/8 = 24000 * 1 * 2 = 48000)
  view.setUint32(28, 48000, true);
  
  // Block Align (NumChannels * BitsPerSample/8 = 2)
  view.setUint16(32, 2, true);
  
  // Bits Per Sample (16-bit)
  view.setUint16(34, 16, true);
  
  // Subchunk2 ID "data"
  view.setUint8(36, 0x64); 
  view.setUint8(37, 0x61); 
  view.setUint8(38, 0x74); 
  view.setUint8(39, 0x61);
  
  // Subchunk2 Size (PCM length)
  view.setUint32(40, len, true);

  // Write PCM data bytes
  for (let i = 0; i < len; i++) {
    view.setUint8(44 + i, binaryString.charCodeAt(i));
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Downloads a base64 audio file with a given filename
 */
export function downloadAudioFromBase64(base64: string, filename: string): void {
  const url = getAudioUrlFromBase64(base64);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Decodes a base64 audio string into a Web Audio API AudioBuffer.
 */
export async function decodeBase64ToAudioBuffer(base64: string, audioCtx: AudioContext): Promise<AudioBuffer> {
  const binaryString = window.atob(base64);
  const isWav = binaryString.startsWith('RIFF');
  const isMp3 = binaryString.startsWith('ID3') || 
                binaryString.startsWith('\xFF\xFB') || 
                binaryString.startsWith('\xFF\xF3') || 
                binaryString.startsWith('\xFF\xF2');
  
  let arrayBuffer: ArrayBuffer;
  if (isWav || isMp3) {
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  } else {
    // Assume raw mono 24khz PCM and wrap
    const len = binaryString.length;
    const buffer = new ArrayBuffer(44 + len);
    const view = new DataView(buffer);
    view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46); // "RIFF"
    view.setUint32(4, 36 + len, true);
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45); // "WAVE"
    view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, 24000, true); // 24000 Hz
    view.setUint32(28, 48000, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // 16-bit
    view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61); // "data"
    view.setUint32(40, len, true);
    for (let i = 0; i < len; i++) {
      view.setUint8(44 + i, binaryString.charCodeAt(i));
    }
    arrayBuffer = buffer;
  }
  
  // Clone the buffer because decodeAudioData consumes it
  const bufferCopy = arrayBuffer.slice(0);
  return await audioCtx.decodeAudioData(bufferCopy);
}

/**
 * Trims and merges multiple AudioBuffers sequentially based on trim ranges.
 */
export function trimAndMergeAudioBuffers(
  blocks: { audioBuffer: AudioBuffer; trimStart: number; trimEnd: number }[],
  audioCtx: AudioContext
): AudioBuffer {
  if (blocks.length === 0) {
    throw new Error("No audio blocks to merge");
  }
  
  const sampleRate = blocks[0].audioBuffer.sampleRate;
  const numberOfChannels = blocks[0].audioBuffer.numberOfChannels;
  
  const slicedBuffers: AudioBuffer[] = [];
  for (const block of blocks) {
    const buf = block.audioBuffer;
    const duration = buf.duration;
    const tStart = Math.max(0, Math.min(block.trimStart, duration));
    const tEnd = Math.max(tStart, Math.min(block.trimEnd || duration, duration));
    
    const startSample = Math.floor(tStart * buf.sampleRate);
    const endSample = Math.floor(tEnd * buf.sampleRate);
    const sampleLength = endSample - startSample;
    
    if (sampleLength <= 0) continue;
    
    const sliced = audioCtx.createBuffer(buf.numberOfChannels, sampleLength, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const channelData = buf.getChannelData(c);
      const sub = channelData.subarray(startSample, endSample);
      sliced.getChannelData(c).set(sub);
    }
    slicedBuffers.push(sliced);
  }
  
  if (slicedBuffers.length === 0) {
    return audioCtx.createBuffer(numberOfChannels, sampleRate, sampleRate);
  }
  
  const totalLength = slicedBuffers.reduce((acc, b) => acc + b.length, 0);
  const merged = audioCtx.createBuffer(numberOfChannels, totalLength, sampleRate);
  
  let offset = 0;
  for (const buf of slicedBuffers) {
    for (let c = 0; c < numberOfChannels; c++) {
      merged.getChannelData(c).set(buf.getChannelData(c), offset);
    }
    offset += buf.length;
  }
  
  return merged;
}

/**
 * Converts a Web Audio API AudioBuffer into a WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = Raw PCM
  const bitDepth = 16;
  
  let result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, bufferLength, true);
  
  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

