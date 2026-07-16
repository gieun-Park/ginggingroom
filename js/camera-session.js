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
  let timerEpoch = 0;
  let captureInProgress = false;
  let state = { status: 'idle', stream: null, remaining: null, error: null };

  function publish(status, {
    stream = activeStream,
    remaining = null,
    error = null
  } = {}) {
    state = { status, stream, remaining, error };
    try {
      onChange(state);
    } catch {}
  }

  function cancelTimer() {
    timerEpoch += 1;
    if (timerHandle !== null) clearTimeoutRef(timerHandle);
    timerHandle = null;
  }

  function stopStream() {
    if (!activeStream) return;
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }

  function finishCapture() {
    if (captureInProgress || !['live', 'countdown'].includes(state.status)) return;
    captureInProgress = true;
    cancelTimer();
    try {
      onCapture();
    } finally {
      stopStream();
      publish('review', { stream: null });
      captureInProgress = false;
    }
  }

  function count(remaining, epoch) {
    publish('countdown', { remaining });
    timerHandle = setTimeoutRef(() => {
      if (epoch !== timerEpoch) return;
      timerHandle = null;
      if (state.status !== 'countdown') return;
      if (remaining === 1) finishCapture();
      else count(remaining - 1, epoch);
    }, 1000);
  }

  return {
    async start() {
      const request = ++generation;
      cancelTimer();
      stopStream();
      publish('starting', { stream: null });
      let stream;
      try {
        stream = await getUserMedia({ video: { facingMode: 'user' } });
      } catch (error) {
        if (request === generation) publish('error', { stream: null, error });
        return;
      }
      if (request !== generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      activeStream = stream;
      publish('live');
    },
    capture(delaySeconds = 0) {
      if (state.status !== 'live') return;
      if (delaySeconds > 0) {
        cancelTimer();
        count(delaySeconds, timerEpoch);
      }
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
