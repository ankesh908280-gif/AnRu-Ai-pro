// speech.js - Speech-to-Text & Text-to-Speech Engine
class SpeechController {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.recognition = null;
        this.isListening = false;
        this.voices = [];
        this.selectedVoice = null;
        this.language = localStorage.getItem('jarvis_lang') || 'hi-IN';
        this.voiceSpeed = parseFloat(localStorage.getItem('jarvis_speed') || '1.05');
        this.voicePitch = parseFloat(localStorage.getItem('jarvis_pitch') || '1.0');

        this.initRecognition();
        this.initSynthesis();
    }

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('SpeechRecognition API not supported on this browser.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = this.language;

        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.callbacks.onStart) this.callbacks.onStart();
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript && this.callbacks.onInterim) {
                this.callbacks.onInterim(interimTranscript);
            }

            if (finalTranscript && this.callbacks.onResult) {
                this.callbacks.onResult(finalTranscript.trim());
            }
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            if (event.error === 'no-speech') {
                if (this.callbacks.onEnd) this.callbacks.onEnd();
                return;
            }
            console.warn('Speech recognition error:', event.error);
            if (this.callbacks.onError) this.callbacks.onError(event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.callbacks.onEnd) this.callbacks.onEnd();
        };
    }

    initSynthesis() {
        if (!('speechSynthesis' in window)) return;

        const loadVoices = () => {
            this.voices = window.speechSynthesis.getVoices();
            this.findBestVoice();
        };

        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    setLanguage(lang) {
        this.language = lang;
        localStorage.setItem('jarvis_lang', lang);
        if (this.recognition) {
            this.recognition.lang = lang;
        }
        this.findBestVoice();
    }

    findBestVoice() {
        if (!('speechSynthesis' in window)) return;
        if (!this.voices || this.voices.length === 0) {
            this.voices = window.speechSynthesis.getVoices();
        }
        if (!this.voices || this.voices.length === 0) return;

        if (this.language.startsWith('hi')) {
            const hiVoice = this.voices.find(v => v.lang.includes('hi') || v.lang.includes('HI'));
            if (hiVoice) {
                this.selectedVoice = hiVoice;
                return;
            }
        }

        const inVoice = this.voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
        if (inVoice) {
            this.selectedVoice = inVoice;
            return;
        }

        const enVoice = this.voices.find(v => v.lang.startsWith('en'));
        this.selectedVoice = enVoice || this.voices[0];
    }

    startListening() {
        if (!this.recognition) {
            if (this.callbacks.onError) this.callbacks.onError('not_supported');
            return;
        }
        try {
            this.stopSpeaking();
            if (!this.isListening) {
                this.recognition.start();
            }
        } catch (e) {
            if (e.name !== 'InvalidStateError') {
                console.warn('Recognition start exception:', e);
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch(e) {}
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    speak(text) {
        if (!('speechSynthesis' in window) || !text) return;

        window.speechSynthesis.cancel();
        this.findBestVoice();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.lang = this.selectedVoice ? this.selectedVoice.lang : this.language;
        utterance.rate = this.voiceSpeed;
        utterance.pitch = this.voicePitch;

        utterance.onstart = () => {
            if (this.callbacks.onSpeakStart) this.callbacks.onSpeakStart();
        };

        utterance.onend = () => {
            if (this.callbacks.onSpeakEnd) this.callbacks.onSpeakEnd();
        };

        utterance.onerror = (e) => {
            console.warn('SpeechSynthesis error:', e);
            if (this.callbacks.onSpeakEnd) this.callbacks.onSpeakEnd();
        };

        window.speechSynthesis.speak(utterance);
    }

    stopSpeaking() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            if (this.callbacks.onSpeakEnd) this.callbacks.onSpeakEnd();
        }
    }
}

window.SpeechController = SpeechController;
