const idleState = () => ({
  status: 'idle',
  photo: null,
  foreground: null,
  error: null
});

export function createBackgroundSession({
  segmenter,
  foregroundBuilder,
  onChange = () => {}
}) {
  let requestId = 0;
  let state = idleState();

  function publish(next) {
    state = next;
    onChange(state);
  }

  async function analyze(photo) {
    const currentRequest = ++requestId;
    publish({ status: 'loading', photo, foreground: null, error: null });
    try {
      const mask = await segmenter.segmentPeople(photo);
      if (currentRequest !== requestId) return;
      const foreground = foregroundBuilder(photo, mask);
      if (currentRequest !== requestId) return;
      publish({ status: 'ready', photo, foreground, error: null });
    } catch (error) {
      if (currentRequest !== requestId) return;
      publish({ status: 'error', photo, foreground: null, error });
    }
  }

  return {
    analyze,
    retry() {
      segmenter.reset();
      return state.photo ? analyze(state.photo) : Promise.resolve();
    },
    reset() {
      requestId += 1;
      publish(idleState());
    },
    getState() {
      return state;
    }
  };
}
