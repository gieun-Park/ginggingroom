import assert from 'node:assert/strict';
import test from 'node:test';
import { createCameraSession } from '../js/camera-session.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function streamSpy(trackCount = 1) {
  const tracks = Array.from({ length: trackCount }, () => ({
    stops: 0,
    stop() {
      this.stops += 1;
    }
  }));
  return {
    tracks,
    stream: { getTracks: () => tracks }
  };
}

test('requests the front camera and publishes exact starting and live states', async () => {
  const calls = [];
  const states = [];
  const { stream } = streamSpy();
  const session = createCameraSession({
    getUserMedia: async constraints => {
      calls.push(constraints);
      return stream;
    },
    onChange: state => states.push(state)
  });

  await session.start();

  assert.deepEqual(calls, [{ video: { facingMode: 'user' } }]);
  assert.deepEqual(states, [
    { status: 'starting', stream: null, remaining: null, error: null },
    { status: 'live', stream, remaining: null, error: null }
  ]);
  assert.equal(session.getState(), states[1]);
});

test('counts five through one, captures once, and enters review', async () => {
  const timers = [];
  const cleared = [];
  const captures = [];
  const states = [];
  const { stream, tracks } = streamSpy(2);
  const session = createCameraSession({
    getUserMedia: async () => stream,
    setTimeoutRef: (callback, delay) => {
      const timer = { callback, delay, handle: timers.length + 1 };
      timers.push(timer);
      return timer.handle;
    },
    clearTimeoutRef: handle => cleared.push(handle),
    onCapture: () => captures.push('capture'),
    onChange: state => states.push(state)
  });
  await session.start();

  session.capture(5);
  session.capture(5);
  for (let index = 0; index < 5; index += 1) timers[index].callback();

  assert.deepEqual(timers.map(timer => timer.delay), [1000, 1000, 1000, 1000, 1000]);
  assert.deepEqual(states.slice(-6), [
    { status: 'countdown', stream, remaining: 5, error: null },
    { status: 'countdown', stream, remaining: 4, error: null },
    { status: 'countdown', stream, remaining: 3, error: null },
    { status: 'countdown', stream, remaining: 2, error: null },
    { status: 'countdown', stream, remaining: 1, error: null },
    { status: 'review', stream: null, remaining: null, error: null }
  ]);
  assert.deepEqual(captures, ['capture']);
  assert.deepEqual(cleared, []);
  assert.deepEqual(tracks.map(track => track.stops), [1, 1]);
});

test('captures immediately when the timer is off', async () => {
  const captures = [];
  const { stream, tracks } = streamSpy();
  const session = createCameraSession({
    getUserMedia: async () => stream,
    onCapture: () => captures.push('capture')
  });
  await session.start();

  session.capture();
  session.capture();

  assert.deepEqual(captures, ['capture']);
  assert.equal(tracks[0].stops, 1);
  assert.deepEqual(session.getState(), {
    status: 'review',
    stream: null,
    remaining: null,
    error: null
  });
});

test('publishes the startup error and can retry', async () => {
  const startupError = new Error('camera denied');
  const { stream, tracks } = streamSpy();
  const requests = [Promise.reject(startupError), Promise.resolve(stream)];
  const states = [];
  const session = createCameraSession({
    getUserMedia: () => requests.shift(),
    onChange: state => states.push(state)
  });

  await session.start();

  assert.deepEqual(session.getState(), {
    status: 'error',
    stream: null,
    remaining: null,
    error: startupError
  });

  await session.start();

  assert.deepEqual(states.map(state => state.status), [
    'starting', 'error', 'starting', 'live'
  ]);
  assert.equal(session.getState().stream, stream);
  assert.equal(tracks[0].stops, 0);
});

test('enterReview cancels a countdown timer and prevents a stale capture', async () => {
  const timers = [];
  const cleared = [];
  let captures = 0;
  const { stream, tracks } = streamSpy();
  const session = createCameraSession({
    getUserMedia: async () => stream,
    setTimeoutRef: callback => {
      timers.push(callback);
      return timers.length;
    },
    clearTimeoutRef: handle => cleared.push(handle),
    onCapture: () => { captures += 1; }
  });
  await session.start();
  session.capture(5);

  session.enterReview();
  timers[0]();

  assert.deepEqual(cleared, [1]);
  assert.equal(captures, 0);
  assert.equal(tracks[0].stops, 1);
  assert.deepEqual(session.getState(), {
    status: 'review',
    stream: null,
    remaining: null,
    error: null
  });
});

test('destroy cancels a countdown and restores the exact idle state', async () => {
  const timers = [];
  const cleared = [];
  let captures = 0;
  const { stream, tracks } = streamSpy();
  const session = createCameraSession({
    getUserMedia: async () => stream,
    setTimeoutRef: callback => {
      timers.push(callback);
      return timers.length;
    },
    clearTimeoutRef: handle => cleared.push(handle),
    onCapture: () => { captures += 1; }
  });
  await session.start();
  session.capture(5);

  session.destroy();
  timers[0]();

  assert.deepEqual(cleared, [1]);
  assert.equal(captures, 0);
  assert.equal(tracks[0].stops, 1);
  assert.deepEqual(session.getState(), {
    status: 'idle',
    stream: null,
    remaining: null,
    error: null
  });
});

test('stops a stream that resolves after destroy without leaving idle', async () => {
  const pending = deferred();
  const { stream, tracks } = streamSpy();
  const states = [];
  const session = createCameraSession({
    getUserMedia: () => pending.promise,
    onChange: state => states.push(state)
  });

  const start = session.start();
  session.destroy();
  pending.resolve(stream);
  await start;

  assert.equal(tracks[0].stops, 1);
  assert.deepEqual(session.getState(), {
    status: 'idle',
    stream: null,
    remaining: null,
    error: null
  });
  assert.deepEqual(states.map(state => state.status), ['starting', 'idle']);
});

test('stops an older stream that resolves after a newer start', async () => {
  const first = deferred();
  const second = deferred();
  const requests = [first.promise, second.promise];
  const older = streamSpy();
  const newer = streamSpy();
  const session = createCameraSession({
    getUserMedia: () => requests.shift()
  });

  const firstStart = session.start();
  const secondStart = session.start();
  second.resolve(newer.stream);
  await secondStart;
  first.resolve(older.stream);
  await firstStart;

  assert.equal(older.tracks[0].stops, 1);
  assert.equal(newer.tracks[0].stops, 0);
  assert.deepEqual(session.getState(), {
    status: 'live',
    stream: newer.stream,
    remaining: null,
    error: null
  });
});
