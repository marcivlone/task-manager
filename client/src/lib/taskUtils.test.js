import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NO_DATE_LABEL,
  NO_STATUS_LABEL,
  buildTaskPayload,
  formatTaskDate,
  formatTaskDateTime,
  getStatusKind,
  getStatusLabel,
  normalizeFilterValue,
  nullableSelectValue,
  parseStoredUser,
} from './taskUtils.js';

test('getStatusLabel uses a valid status name from the server', () => {
  assert.equal(getStatusLabel(1, 'Review'), 'Review');
});

test('getStatusLabel falls back to known local labels', () => {
  assert.equal(getStatusLabel(1, '???'), 'Новая');
  assert.equal(getStatusLabel(2, ''), 'В работе');
  assert.equal(getStatusLabel(3), 'Завершена');
});

test('getStatusLabel uses a custom fallback for unknown status ids', () => {
  assert.equal(getStatusLabel(99, null, NO_STATUS_LABEL), NO_STATUS_LABEL);
});

test('getStatusKind detects task state from id or text', () => {
  assert.equal(getStatusKind(3), 'done');
  assert.equal(getStatusKind(2), 'progress');
  assert.equal(getStatusKind(10, 'Blocked by deploy'), 'blocked');
  assert.equal(getStatusKind(1, 'Backlog'), 'new');
});

test('formatTaskDate returns Russian date or fallback for bad input', () => {
  assert.equal(formatTaskDate(new Date(2026, 5, 16)), '16.06.2026');
  assert.equal(formatTaskDate('not-a-date'), NO_DATE_LABEL);
});

test('formatTaskDateTime returns date and time or empty string for bad input', () => {
  assert.match(formatTaskDateTime(new Date(2026, 5, 16, 9, 5)), /16\.06\.2026.*09:05/);
  assert.equal(formatTaskDateTime('not-a-date'), '');
});

test('normalizeFilterValue clears ui-only select values', () => {
  assert.equal(normalizeFilterValue('all'), '');
  assert.equal(normalizeFilterValue('none'), '');
  assert.equal(normalizeFilterValue('2'), '2');
});

test('nullableSelectValue converts empty select values to null for the API', () => {
  assert.equal(nullableSelectValue(''), null);
  assert.equal(nullableSelectValue('none'), null);
  assert.equal(nullableSelectValue('7'), '7');
});

test('buildTaskPayload prepares task data for create and update requests', () => {
  assert.deepEqual(
    buildTaskPayload({
      title: 'Add tests',
      description: 'Cover task helpers',
      status_id: 'none',
      assigned_to: '12',
    }),
    {
      title: 'Add tests',
      description: 'Cover task helpers',
      status_id: null,
      assigned_to: '12',
    },
  );
});

test('parseStoredUser safely reads the user from localStorage value', () => {
  assert.deepEqual(parseStoredUser('{"id":5,"username":"Masha"}'), {
    id: 5,
    username: 'Masha',
  });
  assert.deepEqual(parseStoredUser('broken-json'), {});
  assert.deepEqual(parseStoredUser('[1,2,3]'), {});
});
