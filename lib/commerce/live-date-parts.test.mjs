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

function weekBounds(iso){
  const [y,m,d]=iso.split('-').map(Number);
  const utc=Date.UTC(y,m-1,d);
  const weekday=new Date(utc).getUTCDay();
  return {
    start:new Date(utc-weekday*86400000).toISOString().slice(0,10),
    end:new Date(utc+(6-weekday)*86400000).toISOString().slice(0,10)
  };
}

test('this week is the soonest later day inside the same Sunday-to-Saturday week', () => {
  assert.equal(weekMoveIn('2026-09-14', '2026-10-14', '2026-09-14'), '2026-09-15');
  assert.equal(weekMoveIn('2026-09-13', '2026-10-13', '2026-09-13'), '2026-09-14');
  assert.notEqual(weekMoveIn('2026-09-13', '2026-10-13', '2026-09-13'), '2026-09-13');
  assert.equal(weekMoveIn('2026-09-19', '2026-10-19', '2026-09-19'), '');
});

test('weekMoveIn never returns a date outside the week of the day it was given', () => {
  const chips=['2026-09-13','2026-09-14','2026-09-15','2026-09-18','2026-09-19','2026-10-03'];
  for(const today of chips){
    const bounds=weekBounds(today);
    const wide=weekMoveIn('2026-09-01','2026-10-31',today);
    const tight=weekMoveIn(today,'2026-10-31',today);
    for(const got of [wide,tight]){
      if(!got)continue;
      assert.ok(got>=bounds.start&&got<=bounds.end,got+' is outside '+bounds.start+'..'+bounds.end+' for '+today);
      assert.ok(got>today,got+' is not later than '+today);
    }
  }
  assert.equal(weekMoveIn('2026-09-19','2026-10-19','2026-09-19'),'');
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const form=src.slice(src.indexOf('function liveDateForm'),src.indexOf('function applyLiveChip'));
  assert.match(form,/const weekChip=week\?/);
  assert.match(form,/You are asking for:/);
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
