import fs from 'node:fs';
import path from 'node:path';
import type { ServerTrackMeta } from '../data/catalog.js';

export function ensureWavFile(track: ServerTrackMeta, cacheDir: string): string {
  fs.mkdirSync(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${track.id}.wav`);
  if (fs.existsSync(filePath)) return filePath;

  const sampleRate = 16000;
  const totalSeconds = Math.max(12, Math.round(track.durationMs / 1000));
  const totalSamples = sampleRate * totalSeconds;

  const beatSec = 60 / Math.max(50, track.synth.tempoBpm);
  const phraseBeats = 16;
  const phraseSamples = Math.max(sampleRate * 4, Math.round(beatSec * phraseBeats * sampleRate));
  const phrase = new Float32Array(phraseSamples);

  const chordCount = Math.max(1, track.synth.chordIntervals.length);
  const samplesPerChord = Math.floor(phraseSamples / chordCount);

  for (let i = 0; i < phraseSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(chordCount - 1, Math.floor(i / samplesPerChord));
    const localPos = (i % samplesPerChord) / samplesPerChord;

    const chordEnv = Math.sin(Math.PI * localPos);
    const semitoneOffset = track.synth.chordIntervals[chordIdx];
    const rootFreq = track.synth.baseFreq * Math.pow(2, semitoneOffset / 12);
    const fifthFreq = rootFreq * 1.4983;
    const octaveFreq = rootFreq * 2;

    const rootOsc =
      track.synth.waveform === 'triangle'
        ? (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * rootFreq * t))
        : Math.sin(2 * Math.PI * rootFreq * t);
    const fifthOsc = Math.sin(2 * Math.PI * fifthFreq * t);
    const subOsc = Math.sin(2 * Math.PI * (rootFreq * 0.5) * t);

    const pulseStep = (t / (beatSec * 0.5)) % 1;
    const pulseEnv = Math.exp(-pulseStep * 5.5);
    const arpMultiplier = Math.floor(t / (beatSec * 0.5)) % 3 === 0 ? 1.5 : 1;
    const pulseOsc = Math.sin(2 * Math.PI * octaveFreq * arpMultiplier * t) * pulseEnv;

    const padSample =
      (rootOsc * 0.5 + fifthOsc * 0.3 + subOsc * 0.25) * chordEnv * track.synth.padLevel;
    const pulseSample = pulseOsc * track.synth.pulseLevel;

    phrase[i] = Math.max(-0.85, Math.min(0.85, padSample + pulseSample));
  }

  const dataBytes = totalSamples * 2;
  const buffer = Buffer.allocUnsafe(44 + dataBytes);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);

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
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
  return filePath;
}

