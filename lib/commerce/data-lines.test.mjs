import test from 'node:test';
import assert from 'node:assert/strict';
import {collectDataLines, dataLineChanges, readDataLines} from '../../tests/ui-clarity/data-lines.mjs';

test('member data lines match the frozen snapshot', () => {
  const found = collectDataLines();
  const saved = readDataLines();
  const changes = dataLineChanges(found, saved);
  assert.deepEqual(changes, [], 'a data line was added, removed, or edited');
});
