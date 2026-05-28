// Pure-function tests for pmsetWakeBlock. We exercise the calendar-walk and
// `pmset -g sched` parser; the side-effectful arm/cancel paths are covered by
// runtime use, not unit tests.

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));

async function loadBlock() {
  return import('../electron/src/lego_blocks/pmsetWakeBlock');
}

type SpecLike = Parameters<Awaited<ReturnType<typeof loadBlock>>['computeUpcomingFireTimesBlock']>[0];

function calendarSpec(entries: Array<{ hour: number; minute: number; weekday?: number }>): SpecLike {
  return {
    key: 'anchor',
    label: 'com.thinkingspace.anchor',
    title: 'Anchor',
    enabled: true,
    execution: { kind: 'shell', command: '/bin/echo', args: ['hi'] },
    schedule: { kind: 'calendar', entries },
    managedBy: 'thinking-space',
    createdAt: '2026-05-22T00:00:00Z',
    updatedAt: '2026-05-22T00:00:00Z',
  } as SpecLike;
}

describe('computeUpcomingFireTimesBlock', () => {
  it('returns sorted future fire times within the horizon', async () => {
    const { computeUpcomingFireTimesBlock } = await loadBlock();
    // 2026-05-28 is a Thursday. Use local-time noon as "now".
    const now = new Date(2026, 4, 28, 12, 0, 0);
    const spec = calendarSpec([
      { hour: 5, minute: 0 },
      { hour: 10, minute: 0 },
      { hour: 15, minute: 0 },
      { hour: 20, minute: 0 },
    ]);
    const fires = computeUpcomingFireTimesBlock(spec, 48 * 3600 * 1000, now);
    const labels = fires.map((d) => `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
    expect(labels).toEqual([
      '5/28 15:00',
      '5/28 20:00',
      '5/29 5:00',
      '5/29 10:00',
      '5/29 15:00',
      '5/29 20:00',
      '5/30 5:00',
      '5/30 10:00',
    ]);
  });

  it('skips past entries on the current day', async () => {
    const { computeUpcomingFireTimesBlock } = await loadBlock();
    const now = new Date(2026, 4, 28, 6, 0, 0);
    const spec = calendarSpec([{ hour: 5, minute: 0 }, { hour: 10, minute: 0 }]);
    const fires = computeUpcomingFireTimesBlock(spec, 24 * 3600 * 1000, now);
    expect(fires[0].getHours()).toBe(10);
    expect(fires[0].getDate()).toBe(28);
  });

  it('honors weekday filter (launchd 7 == Sunday)', async () => {
    const { computeUpcomingFireTimesBlock } = await loadBlock();
    // Thursday 2026-05-28 noon. Asking for Sunday-only entries.
    const now = new Date(2026, 4, 28, 12, 0, 0);
    const spec = calendarSpec([{ hour: 9, minute: 0, weekday: 7 }]);
    const fires = computeUpcomingFireTimesBlock(spec, 7 * 24 * 3600 * 1000, now);
    // Next Sunday is 2026-05-31.
    expect(fires.length).toBeGreaterThan(0);
    expect(fires[0].getDay()).toBe(0);
    expect(fires[0].getDate()).toBe(31);
  });

  it('returns [] for interval schedules', async () => {
    const { computeUpcomingFireTimesBlock } = await loadBlock();
    const spec: SpecLike = {
      ...calendarSpec([]),
      schedule: { kind: 'interval', seconds: 3600 },
    } as SpecLike;
    expect(computeUpcomingFireTimesBlock(spec, 86400000, new Date())).toEqual([]);
  });
});

describe('parsePmsetSchedBlock', () => {
  it('parses owner-tagged wake entries', async () => {
    const { parsePmsetSchedBlock } = await loadBlock();
    const stdout = [
      'Scheduled power events:',
      " [0]  wake at 05/29/2026 04:59:00 by 'thinking-space:com.thinkingspace.cc-anchor'",
      " [1]  wake at 05/29/2026 09:59:00 by 'thinking-space:com.thinkingspace.cc-anchor'",
      " [2]  wake at 05/29/2026 14:59:00 by 'other.tool'",
    ].join('\n');
    const entries = parsePmsetSchedBlock(stdout);
    expect(entries).toHaveLength(3);
    expect(entries[0].type).toBe('wake');
    expect(entries[0].owner).toBe('thinking-space:com.thinkingspace.cc-anchor');
    expect(entries[0].date.getFullYear()).toBe(2026);
    expect(entries[0].date.getHours()).toBe(4);
    expect(entries[2].owner).toBe('other.tool');
  });

  it('parses entries with no owner string', async () => {
    const { parsePmsetSchedBlock } = await loadBlock();
    const stdout = ' wake at 05/29/2026 04:59:00';
    const entries = parsePmsetSchedBlock(stdout);
    expect(entries).toHaveLength(1);
    expect(entries[0].owner).toBeNull();
  });

  it('ignores noise lines', async () => {
    const { parsePmsetSchedBlock } = await loadBlock();
    const stdout = 'Scheduled power events:\nRepeating power events:\n';
    expect(parsePmsetSchedBlock(stdout)).toEqual([]);
  });
});
