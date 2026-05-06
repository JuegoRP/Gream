// ═══════════════════════════════════
//  GREAM — speech.js  v4
//  TTS: best available voice + natural quality
//  STT: voice recording with duration check
// ═══════════════════════════════════

import { getLang } from './i18n.js';

export const Speech = {
  _currentText: '',
  _synth:       window.speechSynthesis || null,
  _recognition: null,
  _voicesLoaded:false,
  _bestVoice:   null,

  supported() { return !!this._synth; },
  setText(text){ this._currentText = text; },
  readCurrent(){ this.speak(this._currentText); },

  // ─── Load and rank voices ───
  // Prefer: Google/Apple natural > Microsoft > default
  _loadVoices() {
    if (this._voicesLoaded) return;
    const voices = this._synth.getVoices();
    if (!voices.length) return; // not ready yet
    this._voicesLoaded = true;
    const lang = getLang() === 'cs' ? 'cs' : 'en';

    // Priority list — names that are known to sound natural
    const preferred = [
      'google',          // Chrome Google voices
      'samantha',        // macOS/iOS English
      'daniel',          // macOS/iOS British
      'moira',           // macOS Irish
      'karen',           // macOS Australian
      'alex',            // macOS US
      'microsoft',       // Windows neural voices
      'natural',
      'enhanced',
      'premium',
    ];

    const langVoices = voices.filter(v =>
      v.lang.toLowerCase().startsWith(lang) &&
      !v.name.toLowerCase().includes('novelty') &&
      !v.name.toLowerCase().includes('whisper')
    );

    // Score each voice
    const scored = langVoices.map(v => {
      const name = v.name.toLowerCase();
      let score = 0;
      preferred.forEach((kw, i) => { if (name.includes(kw)) score = Math.max(score, preferred.length - i); });
      if (v.localService) score += 2; // local voices often better
      return { v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    this._bestVoice = scored[0]?.v || langVoices[0] || voices[0] || null;
  },

  // ─── Speak ───
  speak(text, onEnd) {
    if (!this._synth || !text) return;
    this._synth.cancel();

    // Voices may not be loaded yet — try to load
    if (!this._voicesLoaded) {
      this._loadVoices();
      // If still empty, wait for voiceschanged (once only)
      if (!this._bestVoice && !this._voiceRetryPending) {
        this._voiceRetryPending = true;
        this._synth.onvoiceschanged = () => {
          this._synth.onvoiceschanged = null;
          this._voiceRetryPending = false;
          this._loadVoices();
          this.speak(text, onEnd);
        };
        return;
      }
    }

    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = getLang() === 'cs' ? 'cs-CZ' : 'en-US';
    utt.rate    = 0.88;   // slightly slower — clear for kids
    utt.pitch   = 1.05;   // barely raised — warmer not robotic
    utt.volume  = 1;
    if (this._bestVoice) utt.voice = this._bestVoice;

    const btn = document.getElementById('ttsBtn');
    utt.onend = () => {
      btn?.classList.remove('speaking');
      onEnd?.();
    };
    utt.onerror = () => btn?.classList.remove('speaking');

    btn?.classList.add('speaking');
    this._synth.speak(utt);
  },

  stop() { this._synth?.cancel(); },

  // ─── Auto-read on challenge load (4-6) ───
  autoRead(age, text) {
    if ((age === '4-6') && this.supported() && text) {
      setTimeout(() => this.speak(text), 500);
    }
  },

  // ─── TTS button visibility ───
  updateTTSButton(age) {
    const btn = document.getElementById('ttsBtn');
    if (!btn) return;
    const show = this.supported() && (age === '4-6' || age === '7-9');
    btn.classList.toggle('hidden', !show);
  },

  // ─── Voice recording with MediaRecorder ───
  // Returns blob via onDone(blob, durationMs)
  // Minimum duration enforced by caller
  startRecording(onDone, onError) {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        const chunks = [];
        const startTime = Date.now();
        const mr = new MediaRecorder(stream, { mimeType: this._bestMime() });
        mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: mr.mimeType });
          onDone(blob, Date.now() - startTime);
        };
        mr.start();
        window._activeRecorder = mr;
      })
      .catch(err => onError?.(err));
  },

  stopRecording() {
    if (window._activeRecorder?.state === 'recording') {
      window._activeRecorder.stop();
    }
  },

  _bestMime() {
    const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg','audio/mp4'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  },

  // ─── Speech recognition (transcript) ───
  startListening(onResult, onError) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onError?.('not-supported'); return; }
    this._recognition = new SR();
    this._recognition.lang = getLang() === 'cs' ? 'cs-CZ' : 'en-US';
    this._recognition.continuous      = true;
    this._recognition.interimResults  = true;
    this._recognition.onresult = e => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      onResult?.(transcript, e.results[e.results.length - 1].isFinal);
    };
    this._recognition.onerror = e => onError?.(e.error);
    this._recognition.start();
  },

  stopListening() { this._recognition?.stop(); }
};
