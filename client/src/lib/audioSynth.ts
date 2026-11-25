import type { SynthSpec } from '@soundsphere/shared';

const blobUrlCache = new Map<string, string>();

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Generates a real, deterministic 16-bit PCM WAV Blob URL for a track.
 * Computes a seamless 4-chord phrase loop and tiles it cleanly across the track's full duration
 * so HTMLAudioElement supports instant seeking, real progress, and zero CORS errors.
 */
export function getOrCreateTrackAudioUrl(trackId: string, durationMs: number, synth: SynthSpec): string {
  const cached = blobUrlCache.get(trackId);
  if (cached) return cached;

  const sampleRate = 16000;
  const totalSeconds = Math.max(12, Math.round(durationMs / 1000));
  const totalSamples = sampleRate * totalSeconds;

  const beatSec = 60 / Math.max(50, synth.tempoBpm);
  const phraseBeats = 16; // 4 bars of 4 beats
  const phraseSamples = Math.max(sampleRate * 4, Math.round(beatSec * phraseBeats * sampleRate));
  const phrase = new Float32Array(phraseSamples);

  const chordCount = Math.max(1, synth.chordIntervals.length);
  const samplesPerChord = Math.floor(phraseSamples / chordCount);

  for (let i = 0; i < phraseSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(chordCount - 1, Math.floor(i / samplesPerChord));
    const localPos = (i % samplesPerChord) / samplesPerChord;

    // Smooth cosine envelope per chord to eliminate clicks at chord transitions
    const chordEnv = Math.sin(Math.PI * localPos);
    const semitoneOffset = synth.chordIntervals[chordIdx];
    const rootFreq = synth.baseFreq * Math.pow(2, semitoneOffset / 12);
    const fifthFreq = rootFreq * 1.4983;
    const octaveFreq = rootFreq * 2;

    // Warm pad voices
    const rootOsc =
      synth.waveform === 'triangle'
        ? (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * rootFreq * t))
        : Math.sin(2 * Math.PI * rootFreq * t);
    const fifthOsc = Math.sin(2 * Math.PI * fifthFreq * t);
    const subOsc = Math.sin(2 * Math.PI * (rootFreq * 0.5) * t);

    // Gentle rhythmic arpeggio pulse aligned to eighth notes
    const pulseStep = (t / (beatSec * 0.5)) % 1;
    const pulseEnv = Math.exp(-pulseStep * 5.5);
    const arpMultiplier = (Math.floor(t / (beatSec * 0.5)) % 3 === 0) ? 1.5 : 1;
    const pulseOsc = Math.sin(2 * Math.PI * octaveFreq * arpMultiplier * t) * pulseEnv;

    const padSample = (rootOsc * 0.5 + fifthOsc * 0.3 + subOsc * 0.25) * chordEnv * synth.padLevel;
    const pulseSample = pulseOsc * synth.pulseLevel;

    phrase[i] = Math.max(-0.85, Math.min(0.85, padSample + pulseSample));
  }

  // Write WAV header (44 bytes) + 16-bit mono PCM payload
  const dataBytes = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const fadeOutSamples = Math.min(sampleRate * 2, Math.floor(totalSamples * 0.1));
  const fadeInSamples = Math.min(Math.floor(sampleRate * 0.4), Math.floor(totalSamples * 0.05));

  for (let i = 0; i < totalSamples; i++) {
    let sample = phrase[i % phraseSamples];
    if (i < fadeInSamples) {
      sample *= i / fadeInSamples;
    } else if (i > totalSamples - fadeOutSamples) {
      sample *= (totalSamples - i) / fadeOutSamples;
    }
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped * 32767, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  blobUrlCache.set(trackId, url);
  return url;
}

