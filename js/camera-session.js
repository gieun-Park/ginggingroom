export function createCameraSession({
  getUserMedia,
  setTimeoutRef = setTimeout,
  clearTimeoutRef = clearTimeout,
  onCapture = () => {},
  onChange = () => {}
}) {
  let generation = 0;
  let activeStream = null;
  let timerHandle = null;
  let state = { status: 'idle', stream: null, remaining: null, error: null };

  function publish(status, {
    stream = activeStream,
    remaining = null,
    error = null
  } = {}) {
    state = { status, stream, remaining, error };
    onChange(state);
  }

  function cancelTimer() {
    if (timerHandle !== null) clearTimeoutRef(timerHandle);
    timerHandle = null;
  }

  function stopStream() {
    if (!activeStream) return;
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }

  function finishCapture() {
    if (!['live', 'countdown'].includes(state.status)) return;
    cancelTimer();
    onCapture();
    stopStream();
    publish('review', { stream: null });
  }

  function count(remaining) {
    publish('countdown', { remaining });
    timerHandle = setTimeoutRef(() => {
      timerHandle = null;
      if (state.status !== 'countdown') return;
      if (remaining === 1) finishCapture();
      else count(remaining - 1);
    }, 1000);
  }

  return {
    async start() {
      const request = ++generation;
      cancelTimer();
      stopStream();
      publish('starting', { stream: null });
      try {
        const stream = await getUserMedia({ video: { facingMode: 'user' } });
        if (request !== generation) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        activeStream = stream;
        publish('live');
      } catch (error) {
        if (request === generation) publish('error', { stream: null, error });
      }
    },
    capture(delaySeconds = 0) {
      if (state.status !== 'live') return;
      if (delaySeconds > 0) count(delaySeconds);
      else finishCapture();
    },
    enterReview() {
      generation += 1;
      cancelTimer();
      stopStream();
      publish('review', { stream: null });
    },
    destroy() {
      generation += 1;
      cancelTimer();
      stopStream();
      publish('idle', { stream: null });
    },
    getState() {
      return state;
    }
  };
}
