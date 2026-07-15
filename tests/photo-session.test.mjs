import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhotoSession } from '../js/photo-session.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('publishes loading and ready states and keeps at most ten faces', async () => {
  const states = [];
  const faces = Array.from({ length: 12 }, (_, index) => ({ index }));
  const session = createPhotoSession({
    detector: { detectFaces: async () => faces, reset() {} },
    onChange: state => states.push(state.status)
  });
  await session.analyze({ id: 'photo' });
  assert.deepEqual(states, ['loading', 'ready']);
  assert.equal(session.getState().faces.length, 10);
  assert.equal(session.getState().atLimit, true);
});

test('reports empty and error states while retaining the photo', async () => {
  const empty = createPhotoSession({ detector: { detectFaces: async () => [], reset() {} } });
  await empty.analyze({ id: 'empty-photo' });
  assert.equal(empty.getState().status, 'empty');
  assert.equal(empty.getState().photo.id, 'empty-photo');

  const failed = createPhotoSession({ detector: { detectFaces: async () => { throw new Error('no model'); }, reset() {} } });
  await failed.analyze({ id: 'failed-photo' });
  assert.equal(failed.getState().status, 'error');
  assert.equal(failed.getState().photo.id, 'failed-photo');
});

test('discards a stale result when a newer photo finishes first', async () => {
  const resolvers = new Map();
  const detector = { detectFaces: photo => new Promise(resolve => resolvers.set(photo.id, resolve)), reset() {} };
  const session = createPhotoSession({ detector });
  const first = session.analyze({ id: 'first' });
  const second = session.analyze({ id: 'second' });
  resolvers.get('second')([{ id: 'new-face' }]);
  await second;
  resolvers.get('first')([{ id: 'old-face' }]);
  await first;
  assert.equal(session.getState().photo.id, 'second');
  assert.equal(session.getState().faces[0].id, 'new-face');
});

test('discards a stale rejection after a newer photo succeeds', async () => {
  const requests = new Map();
  const detector = {
    detectFaces(photo) {
      const request = deferred();
      requests.set(photo.id, request);
      return request.promise;
    },
    reset() {}
  };
  const session = createPhotoSession({ detector });
  const first = session.analyze({ id: 'first' });
  const second = session.analyze({ id: 'second' });

  requests.get('second').resolve([{ id: 'new-face' }]);
  await second;
  requests.get('first').reject(new Error('stale failure'));
  await first;

  assert.deepEqual(session.getState(), {
    status: 'ready',
    photo: { id: 'second' },
    faces: [{ id: 'new-face' }],
    error: null,
    atLimit: false
  });
});

test('keeps the idle state when an in-flight success resolves after reset', async () => {
  const request = deferred();
  const session = createPhotoSession({
    detector: { detectFaces: () => request.promise, reset() {} }
  });
  const analysis = session.analyze({ id: 'photo' });

  session.reset();
  request.resolve([{ id: 'stale-face' }]);
  await analysis;

  assert.deepEqual(session.getState(), {
    status: 'idle',
    photo: null,
    faces: [],
    error: null,
    atLimit: false
  });
});

test('keeps the idle state when an in-flight rejection settles after reset', async () => {
  const request = deferred();
  const session = createPhotoSession({
    detector: { detectFaces: () => request.promise, reset() {} }
  });
  const analysis = session.analyze({ id: 'photo' });

  session.reset();
  request.reject(new Error('stale failure'));
  await analysis;

  assert.deepEqual(session.getState(), {
    status: 'idle',
    photo: null,
    faces: [],
    error: null,
    atLimit: false
  });
});

test('retries the retained photo after resetting the detector', async () => {
  const retryRequest = deferred();
  const photo = { id: 'failed-photo' };
  const analyzedPhotos = [];
  const states = [];
  let resetCalls = 0;
  let attempts = 0;
  const detector = {
    detectFaces(currentPhoto) {
      analyzedPhotos.push(currentPhoto);
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('initial failure')) : retryRequest.promise;
    },
    reset() {
      resetCalls += 1;
    }
  };
  const session = createPhotoSession({
    detector,
    onChange: state => states.push(state.status)
  });
  await session.analyze(photo);
  states.length = 0;

  const retry = session.retry();
  assert.equal(resetCalls, 1);
  assert.equal(analyzedPhotos[1], photo);
  assert.deepEqual(states, ['loading']);

  retryRequest.resolve([{ id: 'face' }]);
  await retry;
  assert.deepEqual(states, ['loading', 'ready']);
});

test('publishes an exact clean idle state when reset', async () => {
  const published = [];
  const session = createPhotoSession({
    detector: { detectFaces: async () => [{ id: 'face' }], reset() {} },
    onChange: state => published.push(state)
  });
  await session.analyze({ id: 'photo' });
  published.length = 0;

  session.reset();

  const idle = { status: 'idle', photo: null, faces: [], error: null, atLimit: false };
  assert.deepEqual(session.getState(), idle);
  assert.deepEqual(published, [idle]);
});

test('marks exactly ten detected faces as being at the limit', async () => {
  const faces = Array.from({ length: 10 }, (_, index) => ({ index }));
  const session = createPhotoSession({
    detector: { detectFaces: async () => faces, reset() {} }
  });

  await session.analyze({ id: 'photo' });

  assert.equal(session.getState().atLimit, true);
});

test('retains the photo while loading and caches faces when ready', async () => {
  const request = deferred();
  const photo = { id: 'photo' };
  const faces = [{ id: 'face' }];
  const session = createPhotoSession({
    detector: { detectFaces: () => request.promise, reset() {} }
  });

  const analysis = session.analyze(photo);
  assert.deepEqual(session.getState(), {
    status: 'loading',
    photo,
    faces: [],
    error: null,
    atLimit: false
  });

  request.resolve(faces);
  await analysis;
  assert.deepEqual(session.getState(), {
    status: 'ready',
    photo,
    faces,
    error: null,
    atLimit: false
  });
});
