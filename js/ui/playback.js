/**
 * js/ui/playback.js - Playback Controller, Scrubber, and Keyboard Shortcuts.
 * Conforms to SPEC.md §4.2, ga-lab-vanilla-accessibility, and ga-lab-motion.
 */

export class PlaybackController {
  constructor({
    onStepChange,
    onReset,
    onNextGen
  }) {
    this.onStepChange = onStepChange;
    this.onReset = onReset;
    this.onNextGen = onNextGen;

    this.isPlaying = false;
    this.stepInterval = 600; // ms per step
    this.timerId = null;

    this.currentIndex = 0;
    this.totalSteps = 1;
    this.granularityGen = false;

    this.cacheElements();
    this.bindEvents();
    this.bindKeyboardShortcuts();
  }

  cacheElements() {
    this.el = {
      resetBtn: document.getElementById('reset-btn'),
      stepBackBtn: document.getElementById('step-back-btn'),
      playPauseBtn: document.getElementById('play-pause-btn'),
      stepFwdBtn: document.getElementById('step-fwd-btn'),
      nextGenBtn: document.getElementById('next-gen-btn'),
      scrubberTrack: document.getElementById('scrubber-track'),
      scrubberFill: document.getElementById('scrubber-fill'),
      scrubberThumb: document.getElementById('scrubber-thumb'),
      scrubberGenLabel: document.getElementById('scrubber-gen-label'),
      scrubberStepCount: document.getElementById('scrubber-step-count'),
      speedSlider: document.getElementById('speed-slider'),
      speedVal: document.getElementById('speed-val'),
      granularityToggle: document.getElementById('granularity-toggle')
    };
  }

  bindEvents() {
    this.el.playPauseBtn.addEventListener('click', () => this.togglePlay());
    this.el.stepFwdBtn.addEventListener('click', () => {
      this.pause();
      this.stepForward();
    });
    this.el.stepBackBtn.addEventListener('click', () => {
      this.pause();
      this.stepBackward();
    });
    this.el.nextGenBtn.addEventListener('click', () => {
      this.pause();
      if (this.onNextGen) this.onNextGen();
    });
    this.el.resetBtn.addEventListener('click', () => {
      this.pause();
      if (this.onReset) this.onReset();
    });

    this.el.speedSlider.addEventListener('input', (e) => {
      // Invert slider: smaller ms = faster
      const maxVal = 1600;
      this.stepInterval = maxVal - parseInt(e.target.value, 10);
      const speedMultiplier = (600 / this.stepInterval).toFixed(1);
      this.el.speedVal.textContent = `${speedMultiplier}x`;
      if (this.isPlaying) {
        this.restartTimer();
      }
    });

    this.el.granularityToggle.addEventListener('change', (e) => {
      this.granularityGen = e.target.checked;
    });

    this.el.scrubberTrack.addEventListener('click', (e) => {
      this.handleScrubberClick(e);
    });

    // Scrubber keyboard arrow support
    this.el.scrubberTrack.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        this.stepForward();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        this.stepBackward();
        e.preventDefault();
      }
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing inside an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        this.togglePlay();
        e.preventDefault();
      } else if (e.code === 'ArrowRight') {
        this.pause();
        this.stepForward();
        e.preventDefault();
      } else if (e.code === 'ArrowLeft') {
        this.pause();
        this.stepBackward();
        e.preventDefault();
      } else if (e.code === 'KeyR') {
        this.pause();
        if (this.onReset) this.onReset();
        e.preventDefault();
      }
    });
  }

  handleScrubberClick(e) {
    const rect = this.el.scrubberTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetIdx = Math.round(ratio * (this.totalSteps - 1));
    this.pause();
    this.setStepIndex(targetIdx);
  }

  updateScrubberUI(currentStep, totalSteps, currentGen = 1, phaseName = '') {
    this.currentIndex = currentStep;
    this.totalSteps = Math.max(1, totalSteps);

    const percent = this.totalSteps > 1 ? (this.currentIndex / (this.totalSteps - 1)) * 100 : 0;
    this.el.scrubberFill.style.width = `${percent}%`;
    this.el.scrubberThumb.style.left = `${percent}%`;

    this.el.scrubberGenLabel.textContent = `Gen ${currentGen}: ${phaseName}`;
    this.el.scrubberStepCount.textContent = `Step ${this.currentIndex + 1} of ${this.totalSteps}`;

    this.el.stepBackBtn.disabled = this.currentIndex <= 0;
    this.el.stepFwdBtn.disabled = this.currentIndex >= this.totalSteps - 1;
  }

  stepForward() {
    if (this.currentIndex < this.totalSteps - 1) {
      this.setStepIndex(this.currentIndex + 1);
    } else {
      this.pause();
    }
  }

  stepBackward() {
    if (this.currentIndex > 0) {
      this.setStepIndex(this.currentIndex - 1);
    }
  }

  setStepIndex(idx) {
    this.currentIndex = Math.max(0, Math.min(idx, this.totalSteps - 1));
    if (this.onStepChange) {
      this.onStepChange(this.currentIndex);
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.currentIndex >= this.totalSteps - 1) {
      this.setStepIndex(0);
    }
    this.isPlaying = true;
    this.el.playPauseBtn.innerHTML = '❚❚ Pause';
    this.el.playPauseBtn.classList.add('btn-accent');
    this.restartTimer();
  }

  pause() {
    this.isPlaying = false;
    this.el.playPauseBtn.innerHTML = '▶ Play';
    this.el.playPauseBtn.classList.remove('btn-accent');
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  restartTimer() {
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = setTimeout(() => {
      if (!this.isPlaying) return;

      if (this.granularityGen) {
        if (this.onNextGen) this.onNextGen();
      } else {
        this.stepForward();
      }

      if (this.currentIndex < this.totalSteps - 1 && this.isPlaying) {
        this.restartTimer();
      } else {
        this.pause();
      }
    }, this.stepInterval);
  }
}
