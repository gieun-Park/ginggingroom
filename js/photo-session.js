export function createPhotoSession({ detector, onChange = () => {} }) {
  let requestId = 0;
  let state = { status: 'idle', photo: null, faces: [], error: null, atLimit: false };

  function publish(next) {
    state = next;
    onChange(state);
  }

  async function analyze(photo) {
    const currentRequest = ++requestId;
    publish({ status: 'loading', photo, faces: [], error: null, atLimit: false });
    try {
      const detected = await detector.detectFaces(photo);
      if (currentRequest !== requestId) return;
      const faces = detected.slice(0, 10);
      publish({
        status: faces.length ? 'ready' : 'empty',
        photo,
        faces,
        error: null,
        atLimit: detected.length >= 10
      });
    } catch (error) {
      if (currentRequest !== requestId) return;
      publish({ status: 'error', photo, faces: [], error, atLimit: false });
    }
  }

  return {
    analyze,
    retry() {
      detector.reset();
      return state.photo ? analyze(state.photo) : Promise.resolve();
    },
    reset() {
      requestId += 1;
      publish({ status: 'idle', photo: null, faces: [], error: null, atLimit: false });
    },
    getState() {
      return state;
    }
  };
}
