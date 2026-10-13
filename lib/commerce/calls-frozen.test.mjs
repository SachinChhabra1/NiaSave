import test from 'node:test';
import assert from 'node:assert/strict';
import {callChanges, collectCalls, readCalls} from '../../tests/ui-clarity/calls.mjs';

test('member server calls match the frozen inventory', () => {
  const changes = callChanges(collectCalls(), readCalls());
  assert.deepEqual(changes, [], 'a path, method, body key, or storage key changed');
});
