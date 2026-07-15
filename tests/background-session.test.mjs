import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackgroundSession } from '../js/background-session.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('publishes loading and caches one foreground when analysis succeeds', async () => {
  const photo = { id: 'photo' };
  const mask = { width: 1, height: 1, confidence: new Float32Array([1]) };
  const foreground = { id: 'foreground' };
  const states = [];
  const session = createBackgroundSession({
    segmenter: { segmentPeople: async () => mask, reset() {} },
    foregroundBuilder: (photoArg, maskArg) => {
      assert.equal(photoArg, photo);
      assert.equal(maskArg, mask);
      return foreground;
    },
    onChange: state => states.push(state)
  });

  await session.analyze(photo);
  assert.deepEqual(states.map(state => state.status), ['loading', 'ready']);
  assert.deepEqual(session.getState(), {
    status: 'ready',
    photo,
    foreground,
    error: null
  });
});

test('retry resets only the segmenter and reuses the retained photo', async () => {
  const photo = { id: 'photo' };
  const calls = [];
  let attempt = 0;
  const session = createBackgroundSession({
    segmenter: {
      async segmentPeople(photoArg) {
        calls.push(['segment', photoArg]);
        attempt += 1;
        if (attempt === 1) throw new Error('first failure');
        return { width: 1, height: 1, confidence: new Float32Array([1]) };
      },
      reset() { calls.push(['reset']); }
    },
    foregroundBuilder: () => ({ id: 'foreground' })
  });

  await session.analyze(photo);
  assert.equal(session.getState().status, 'error');
  await session.retry();
  assert.equal(session.getState().status, 'ready');
  assert.deepEqual(calls, [['segment', photo], ['reset'], ['segment', photo]]);
});

test('older success and failure cannot replace the newest photo', async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  const requests = [oldRequest.promise, newRequest.promise];
  const session = createBackgroundSession({
    segmenter: { segmentPeople: () => requests.shift(), reset() {} },
    foregroundBuilder: photo => ({ id: `foreground-${photo.id}` })
  });

  const oldAnalysis = session.analyze({ id: 'old' });
  const newPhoto = { id: 'new' };
  const newAnalysis = session.analyze(newPhoto);
  newRequest.resolve({ width: 1, height: 1, confidence: new Float32Array([1]) });
  await newAnalysis;
  oldRequest.reject(new Error('old failure'));
  await oldAnalysis;

  assert.equal(session.getState().status, 'ready');
  assert.equal(session.getState().photo, newPhoto);
  assert.deepEqual(session.getState().foreground, { id: 'foreground-new' });
});

test('reset invalidates pending work and restores the exact idle state', async () => {
  const request = deferred();
  const states = [];
  const session = createBackgroundSession({
    segmenter: { segmentPeople: () => request.promise, reset() {} },
    foregroundBuilder: () => ({ id: 'foreground' }),
    onChange: state => states.push(state)
  });

  const analysis = session.analyze({ id: 'photo' });
  session.reset();
  request.resolve({ width: 1, height: 1, confidence: new Float32Array([1]) });
  await analysis;

  assert.deepEqual(session.getState(), {
    status: 'idle',
    photo: null,
    foreground: null,
    error: null
  });
  assert.deepEqual(states.map(state => state.status), ['loading', 'idle']);
});
