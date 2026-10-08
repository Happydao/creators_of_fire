import test from 'node:test';
import assert from 'node:assert/strict';
import { previewWindow } from '../src/mix.js';
import { mappedRequest, requestForm } from '../src/form-config.js';
test('Fire Mix chooses a 30-second interior window while preserving the ending', () => {
  for (const duration of [120, 240, 400, 720]) {
    for (const random of [0, .5, 1]) {
      const w = previewWindow(duration, () => random);
      assert.ok(w.start >= duration * .25 - .1 && w.start <= duration * .4 + .1);
      assert.equal(w.length, 30);
      assert.ok(w.end <= duration - 15);
    }
  }
});
test('short tracks receive a bounded preview; unknown duration defers calculation', () => {
  for (const duration of [8, 20, 32, 44, 60]) {
    const w = previewWindow(duration, () => .7);
    assert.ok(w.start >= 0 && w.end < duration && w.length <= 30);
  }
  assert.equal(previewWindow(0), null);
});
test('English choices map to the exact published Italian Form values and entry IDs', () => {
  const params = mappedRequest({name:'Test artist', email:'', title:'', instrumental:'No, con testo',genre:'__other_option__',otherGenre:'Ambient folk',mood:'Oscura',description:'Test description',consent:'on'});
  assert.equal(params.get('entry.1770471919'),'Test artist');
  assert.equal(params.get('entry.773644728'),'No, con testo');
  assert.equal(params.get('entry.1065046570'),'__other_option__');
  assert.equal(params.get('entry.1065046570.other_option_response'),'Ambient folk');
  assert.equal(params.get('entry.1166974658'),'Oscura');
  assert.equal(params.get('entry.1362083836'),'Accetto le condizioni');
  assert.equal(requestForm.fields.email.required,false);
});
test('missing consent and unsupported option cannot be submitted', () => {
  const base = {name:'Test',instrumental:'Indifferente',genre:'Pop',mood:'Epica',description:'Description'};
  assert.throws(()=>mappedRequest(base),/consent/);
  assert.throws(()=>mappedRequest({...base,consent:'on',mood:'Epic'}),/Invalid option/);
});
