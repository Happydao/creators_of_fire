import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { category, filterTracks, formatTime, nextIndex, shuffled, validTrack } from '../src/catalog.js';
test('catalog contains unique, valid videos belonging to the verified channel', async () => {
  const data = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url)));
  assert.equal(data.channelId, 'UCebUIqV2bAL9L2e_apvQSFw');
  assert.ok(data.tracks.length > 0); assert.ok(data.tracks.every(validTrack));
  assert.equal(new Set(data.tracks.map(t => t.id)).size, data.tracks.length);
});
test('shuffle retains all tracks, excludes duplicate first track and handles singleton', () => {
  const result = shuffled(['a','b','c','d'], 'b', () => .2);
  assert.equal(result[0], 'b'); assert.equal(new Set(result).size, 4);
  assert.deepEqual([...result].sort(), ['a','b','c','d']); assert.deepEqual(shuffled(['a'], 'a'), ['a']);
});
test('queue boundaries distinguish repeat all from natural completion', () => {
  assert.equal(nextIndex(2, 3, 'off'), -1); assert.equal(nextIndex(2, 3, 'all'), 0);
  assert.equal(nextIndex(0, 3, 'all', -1), 2); assert.equal(nextIndex(0, 0, 'all'), -1);
});
test('search and saved filters combine, including empty searches', () => {
  const tracks = [{id:'a',title:'Hour Pegasus - Drum And Bass Music'}, {id:'b',title:'DANCE - House Music'}];
  assert.equal(filterTracks(tracks, 'Drum & bass', ' pegasus ', new Set()).length, 1);
  assert.equal(filterTracks(tracks, 'Saved', '', new Set(['b']))[0].id, 'b');
  assert.equal(filterTracks(tracks, 'All', 'nothing', new Set()).length, 0);
  assert.equal(category('Unknown title'), 'Beyond genres');
});
test('duration handles hours and unavailable metadata without inventing a length', () => {
  assert.equal(formatTime(352), '5:52'); assert.equal(formatTime(3661), '1:01:01');
  assert.equal(formatTime(undefined), '—:—'); assert.equal(formatTime(0), '0:00');
});
