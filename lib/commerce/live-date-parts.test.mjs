import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {monthsInRange, daysInRange, weekMoveIn} from '../../commerce-books.js';

test('month list contains the shown month when minDate is the 30th', () => {
  const min = '2026-09-30';
  const max = '2026-10-30';
  const months = monthsInRange(2026, min, max);
  assert.deepEqual(months, [9, 10]);
  assert.ok(months.includes(9));
  assert.deepEqual(daysInRange(2026, 9, min, max), [30]);
  assert.deepEqual(daysInRange(2026, 10, min, max), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
});

test('this week is a later day in the Sunday-to-Saturday week, not the coming Sunday', () => {
  assert.equal(weekMoveIn('2026-09-14', '2026-10-14', '2026-09-14'), '2026-09-19');
  assert.equal(weekMoveIn('2026-09-13', '2026-10-13', '2026-09-13'), '2026-09-19');
  assert.notEqual(weekMoveIn('2026-09-13', '2026-10-13', '2026-09-13'), '2026-09-13');
});

test('nestStart is written only by loadNests and the nest search submit', () => {
  const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
  const lines = src.split('\n');
  const writes = [];
  lines.forEach((line, index) => {
    if (/(?:^|[^\w$])nestStart\s*=/.test(line)) writes.push({line: index + 1, text: line.trim()});
  });
  const assignments = writes.filter(item => !/^\s*(?:let|const|var)\b/.test(item.text) && !/\blet\b/.test(item.text));
  assert.deepEqual(assignments.map(item => item.text), [
    "async function loadNests(){nestData=nestStart?await api('/nests/availability',{start:nestStart}):await api('/nests');nestStart=nestData.start;emitAnalytics('live','availability_search',{outcome:(nestData.offers||[]).length?'results':'empty'});}",
    "if(form.id==='nest-search-form'){liveDateDraft='';nestStart=fields.start;await loadNests();render();}"
  ]);
  const load = src.slice(src.indexOf('async function loadNests'), src.indexOf('async function loadNests') + 500);
  const submitAt = src.indexOf("if(form.id==='nest-search-form')");
  const submit = src.slice(submitAt, submitAt + 160);
  assert.match(load, /nestStart=nestData\.start/);
  assert.match(submit, /nestStart=fields\.start/);
  assert.equal((src.match(/nestStart\s*=/g) || []).length, 3);
});
