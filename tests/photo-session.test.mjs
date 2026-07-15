import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhotoSession } from '../js/photo-session.js';

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
