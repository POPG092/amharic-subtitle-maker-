import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportToAss,
  exportToJson,
  exportToSrt,
  exportToTxt,
  exportToVtt,
  findActiveCue,
  formatAssTime,
  formatDisplayTime,
  formatSrtTime,
  formatVttTime,
  getSubtitleStats,
  mergeWithNextCue,
  normalizeCues,
  parseTimestampToMs,
  shiftCueTimings,
  splitCue,
} from './subtitles';

test('parseTimestampToMs handles HH:MM:SS.mmm, MM:SS,mmm, and numeric seconds', () => {
  assert.equal(parseTimestampToMs('00:01:23.450'), 83450);
  assert.equal(parseTimestampToMs('00:01:23,450'), 83450);
  assert.equal(parseTimestampToMs('02:05.5'), 125500);
  assert.equal(parseTimestampToMs('14.25'), 14250);
  assert.equal(parseTimestampToMs(3.5), 3500);
  assert.equal(parseTimestampToMs(-2), 0);
});

test('timecode formatters output standard SRT, VTT, ASS, and display formats', () => {
  assert.equal(formatSrtTime(3723456), '01:02:03,456');
  assert.equal(formatVttTime(3723456), '01:02:03.456');
  assert.equal(formatAssTime(3723456), '1:02:03.45');
  assert.equal(formatDisplayTime(83450), '01:23.4');
});

test('normalizeCues sorts cues, removes blanks, and resolves overlaps', () => {
  const cues = normalizeCues([
    { startTime: '00:05.000', endTime: '00:08.000', amharicText: 'ሁለተኛ መስመር' },
    { startTime: '00:00.000', endTime: '00:06.000', amharicText: 'መጀመሪያ መስመር' },
    { startTime: '00:09.000', endTime: '00:10.000', amharicText: '   ' },
  ]);

  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'መጀመሪያ መስመር');
  assert.equal(cues[0].endMs, 5000);
  assert.equal(cues[1].startMs, 5000);
  assert.equal(cues[1].index, 2);
});

test('exportToSrt and exportToVtt preserve Amharic Ethiopic script and optional UTF-8 BOM', () => {
  const cues = normalizeCues([
    { startMs: 0, endMs: 2500, amharicText: 'ሰላም ለሁላችሁ' },
    { startMs: 2800, endMs: 5200, amharicText: 'እንኳን በደህና መጡ', speaker: 'Speaker 1' },
  ]);

  const srt = exportToSrt(cues, { includeUtf8Bom: true, includeSpeakerLabels: true });
  assert.equal(srt.startsWith('\uFEFF1\n00:00:00,000 --> 00:00:02,500\nሰላም ለሁላችሁ'), true);
  assert.equal(srt.includes('[Speaker 1] እንኳን በደህና መጡ'), true);

  const vtt = exportToVtt(cues);
  assert.equal(vtt.startsWith('WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.500\nሰላም ለሁላችሁ'), true);
});

test('exportToAss, exportToTxt, and exportToJson produce valid structured outputs', () => {
  const cues = normalizeCues([
    { startMs: 1000, endMs: 3500, amharicText: 'ይህ የሙከራ ንኡስ ርዕስ ነው', originalText: 'This is a test subtitle' },
  ]);

  const ass = exportToAss(cues, { title: 'Test Video' });
  assert.equal(ass.includes('Style: Default,Noto Sans Ethiopic,54'), true);
  assert.equal(ass.includes('Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,ይህ የሙከራ ንኡስ ርዕስ ነው'), true);

  const txt = exportToTxt(cues, { includeTimestampsInTxt: true });
  assert.equal(txt.trim(), '[00:01.0 - 00:03.5] ይህ የሙከራ ንኡስ ርዕስ ነው');

  const json = JSON.parse(exportToJson(cues));
  assert.equal(json.language, 'am');
  assert.equal(json.cues[0].amharicText, 'ይህ የሙከራ ንኡስ ርዕስ ነው');
});

test('shiftCueTimings, splitCue, mergeWithNextCue, findActiveCue, and getSubtitleStats work accurately', () => {
  const base = normalizeCues([
    { startMs: 1000, endMs: 5000, amharicText: 'ዛሬ ስለ ቴክኖሎጂ እና ስለ ፊደል እንነጋገራለን' },
    { startMs: 5500, endMs: 8000, amharicText: 'በጣም ጥሩ ሃሳብ ነው' },
  ]);

  const shifted = shiftCueTimings(base, -1500);
  assert.equal(shifted[0].startMs, 0);
  assert.equal(shifted[0].endMs, 4000);
  assert.equal(shifted[1].startMs, 4000);

  const split = splitCue(base, base[0].id);
  assert.equal(split.length, 3);
  assert.equal(split[0].endMs, 3000);
  assert.equal(split[1].startMs, 3000);

  const merged = mergeWithNextCue(split, split[0].id);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].endMs, 5000);

  const active = findActiveCue(base, 6000);
  assert.equal(active?.id, base[1].id);
  assert.equal(findActiveCue(base, 5200), null);

  const stats = getSubtitleStats(base);
  assert.equal(stats.cueCount, 2);
  assert.equal(stats.totalDurationMs, 8000);
  assert.equal(stats.ethiopicCharCount > 15, true);
});
