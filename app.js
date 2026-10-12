// app.js - Master Controller for ANRU AI PWA with Hardware & Action Handlers

document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new window.QuantumVisualizer('orbCanvas');
    const sfx = window.soundFX;
    const brain = new (window.AnruBrain || window.JarvisBrain)();

    // DOM Elements
    const micBtn = document.getElementById('micBtn');
    const orbStatusLabel = document.getElementById('orbStatusLabel');
    const userSpeechText = document.getElementById('userSpeechText');
    const jarvisResponseText = document.getElementById('jarvisResponseText');
    const connStatus = document.getElementById('connStatus');
    const bossDisplay = document.getElementById('bossDisplay');
    const voiceLangDisplay = document.getElementById('voiceLangDisplay');
    const keyboardToggleBtn = document.getElementById('keyboardToggleBtn');
    const textInputDrawer = document.getElementById('textInputDrawer');
    const manualInput = document.getElementById('manualInput');
    const manualSendBtn = document.getElementById('manualSendBtn');
    const sfxToggleBtn = document.getElementById('sfxToggleBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const inputBossName = document.getElementById('inputBossName');
    const selectPersonality = document.getElementById('selectPersonality');
    const selectLanguage = document.getElementById('selectLanguage');
    const actionChips = document.querySelectorAll('.action-chip');

    // Fake Call Elements
    const fakeCallOverlay = document.getElementById('fakeCallOverlay');
    const fakeCallerName = document.getElementById('fakeCallerName');
    const fakeCallerStatus = document.getElementById('fakeCallerStatus');
    const fakeCallDuration = document.getElementById('fakeCallDuration');
    const fakeCallDeclineBtn = document.getElementById('fakeCallDeclineBtn');
    const fakeCallAcceptBtn = document.getElementById('fakeCallAcceptBtn');

    // VIP Contacts Elements
    const contactNameInput = document.getElementById('contactNameInput');
    const contactPhoneInput = document.getElementById('contactPhoneInput');
    const addContactBtn = document.getElementById('addContactBtn');
    const contactsListDisplay = document.getElementById('contactsListDisplay');

    let isSfxMuted = false;
    let isProcessing = false;
    let typeInterval = null;
    let torchStream = null;
    let fakeCallTimer = null;
    let activeCallDurationTimer = null;

    function updateTelemetry() {
        bossDisplay.textContent = `BOSS: ${brain.bossName.toUpperCase()}`;
        voiceLangDisplay.textContent = (localStorage.getItem('jarvis_lang') || 'hi-IN').toUpperCase();
        if (typeof window.AndroidBridge !== 'undefined') {
            connStatus.textContent = 'SYSTEM // NATIVE APK';
            connStatus.style.color = '#00f2fe';
        }
    }
    window.onNativeBridgeReady = function() {
        updateTelemetry();
        if (window.AndroidBridge && window.AndroidBridge.startForegroundService) {
            window.AndroidBridge.startForegroundService();
        }
    };
    updateTelemetry();

    function renderContactsList() {
        if (!contactsListDisplay) return;
        contactsListDisplay.innerHTML = '';
        const contacts = brain.getContacts();
        for (const [name, phone] of Object.entries(contacts)) {
            const pill = document.createElement('span');
            pill.className = 'contact-pill';
            pill.textContent = `${name.toUpperCase()}: ${phone}`;
            contactsListDisplay.appendChild(pill);
        }
    }
    renderContactsList();

    if (addContactBtn) {
        addContactBtn.addEventListener('click', () => {
            const name = contactNameInput.value.trim();
            const phone = contactPhoneInput.value.trim();
            if (name && phone) {
                brain.saveContact(name, phone);
                contactNameInput.value = '';
                contactPhoneInput.value = '';
                renderContactsList();
            }
        });
    }

    const speech = new window.SpeechController({
        onStart: () => {
            micBtn.classList.add('active');
            orbStatusLabel.textContent = 'LISTENING // SPEAK NOW';
            visualizer.setState('listening');
            sfx.playActivate();
        },
        onInterim: (interimText) => {
            userSpeechText.textContent = interimText;
        },
        onResult: (finalText) => {
            userSpeechText.textContent = finalText;
            handleUserQuery(finalText);
        },
        onEnd: () => {
            micBtn.classList.remove('active');
            if (!isProcessing) {
                orbStatusLabel.textContent = 'STANDBY // READY';
                visualizer.setState('idle');
            }
        },
        onError: (err) => {
            micBtn.classList.remove('active');
            isProcessing = false;
            orbStatusLabel.textContent = 'STANDBY // READY';
            visualizer.setState('idle');
            sfx.playError();
            if (err === 'not_supported') {
                jarvisResponseText.textContent = 'Mic access is not supported in this browser. Please use the text input below.';
            } else if (err === 'not-allowed') {
                jarvisResponseText.textContent = 'Microphone permission blocked. Please allow mic in browser settings.';
            }
        },
        onSpeakStart: () => {
            orbStatusLabel.textContent = 'SPEAKING // TRANSMITTING';
            visualizer.setState('speaking');
        },
        onSpeakEnd: () => {
            isProcessing = false;
            orbStatusLabel.textContent = 'STANDBY // READY';
            visualizer.setState('idle');
        }
    });

    let hasInteracted = false;
    function triggerFirstInteraction() {
        if (!hasInteracted) {
            hasInteracted = true;
            sfx.playBoot();
        }
    }
    document.body.addEventListener('click', triggerFirstInteraction, { once: true });

    async function handleUserQuery(queryText) {
        if (!queryText || !queryText.trim() || isProcessing) return;

        isProcessing = true;
        orbStatusLabel.textContent = 'PROCESSING // COMMAND';
        visualizer.setState('processing');
        sfx.playProcessing();

        try {
            const result = await brain.processQuery(queryText);
            const answer = result.text;

            displayTypewriter(answer);
            sfx.playResponse();
            speech.speak(answer);

            // Execute Action Command if present
            if (result.action) {
                executeAction(result.action);
            }
        } catch (err) {
            console.error('Error handling query:', err);
            isProcessing = false;
            visualizer.setState('idle');
            sfx.playError();
            jarvisResponseText.textContent = 'System error occurred while processing command.';
        }
    }

    function displayTypewriter(fullText) {
        if (typeInterval) clearInterval(typeInterval);
        jarvisResponseText.textContent = '';
        let index = 0;
        
        typeInterval = setInterval(() => {
            if (index < fullText.length) {
                jarvisResponseText.textContent += fullText.charAt(index);
                index++;
            } else {
                clearInterval(typeInterval);
            }
        }, 16);
    }

    // Helper: Detect native Android bridge
    function isAndroidBridgeActive() {
        return typeof window.AndroidBridge !== 'undefined' && 
               typeof window.AndroidBridge.isAndroid === 'function' && 
               window.AndroidBridge.isAndroid();
    }

    // --- Action Executor with Native Android & Web Fallbacks ---
    async function executeAction(act) {
        const isNative = isAndroidBridgeActive();

        switch (act.type) {
            case 'CALL':
                if (isNative && window.AndroidBridge.directCall) {
                    window.AndroidBridge.directCall(act.number);
                } else {
                    setTimeout(() => {
                        window.location.href = `tel:${act.number}`;
                    }, 1200);
                }
                break;

            case 'WHATSAPP':
                if (isNative && window.AndroidBridge.sendWhatsApp) {
                    window.AndroidBridge.sendWhatsApp(act.phone || '', act.message);
                } else {
                    setTimeout(() => {
                        let waUrl = 'https://api.whatsapp.com/send?';
                        if (act.phone) waUrl += `phone=${encodeURIComponent(act.phone)}&`;
                        waUrl += `text=${encodeURIComponent(act.message)}`;
                        window.open(waUrl, '_blank');
                    }, 1200);
                }
                break;

            case 'OPEN_APP':
                if (isNative && window.AndroidBridge.openApp) {
                    const launched = window.AndroidBridge.openApp(act.app || act.query);
                    if (!launched) {
                        // Fallback to web search if not installed
                        setTimeout(() => {
                            window.open(`https://www.google.com/search?q=${encodeURIComponent(act.app || act.query)}`, '_blank');
                        }, 1200);
                    }
                } else {
                    setTimeout(() => {
                        if (act.app === 'youtube') {
                            const ytUrl = act.query 
                                ? `https://www.youtube.com/results?search_query=${encodeURIComponent(act.query)}`
                                : 'https://www.youtube.com';
                            window.open(ytUrl, '_blank');
                        } else if (act.app === 'instagram') {
                            window.open('https://instagram.com', '_blank');
                        } else if (act.app === 'spotify') {
                            window.open('https://open.spotify.com', '_blank');
                        } else if (act.app === 'maps') {
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.query || '')}`, '_blank');
                        } else if (act.app === 'google') {
                            window.open(`https://www.google.com/search?q=${encodeURIComponent(act.query || '')}`, '_blank');
                        } else {
                            window.open(`https://www.google.com/search?q=${encodeURIComponent(act.app || '')}`, '_blank');
                        }
                    }, 1200);
                }
                break;

            case 'TORCH':
                if (isNative && window.AndroidBridge.setFlashlight) {
                    window.AndroidBridge.setFlashlight(act.state === 'on');
                } else {
                    await toggleTorch(act.state === 'on');
                }
                break;

            case 'ALARM':
                if (isNative && window.AndroidBridge.setAlarm) {
                    window.AndroidBridge.setAlarm(act.hour || 6, act.minute || 0, act.message || 'ANRU AI Alarm');
                } else {
                    displayTypewriter(`Boss, ${act.hour}:${act.minute || '00'} ka alarm note kar liya hai!`);
                }
                break;

            case 'VOLUME':
                if (isNative && window.AndroidBridge.setVolume) {
                    window.AndroidBridge.setVolume(act.percent !== undefined ? act.percent : 70);
                }
                break;

            case 'FLOATING_WIDGET':
                if (isNative && window.AndroidBridge.toggleFloatingWidget) {
                    window.AndroidBridge.toggleFloatingWidget();
                } else {
                    const msg = "Floating Arc Reactor Android APK mode me hi supported hai, Boss!";
                    displayTypewriter(msg);
                    speech.speak(msg);
                }
                break;

            case 'ACCESSIBILITY_SETTINGS':
                if (isNative && window.AndroidBridge.openAccessibilitySettings) {
                    window.AndroidBridge.openAccessibilitySettings();
                }
                break;

            case 'VIBRATE':
                if (isNative && window.AndroidBridge.vibrate) {
                    window.AndroidBridge.vibrate("200,100,200,100,400");
                } else if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200, 100, 400]);
                }
                break;

            case 'LOCATION':
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const lat = pos.coords.latitude.toFixed(4);
                            const lon = pos.coords.longitude.toFixed(4);
                            const locMsg = `Live GPS: Lat ${lat}, Lon ${lon}. Region: Uttar Pradesh, India.`;
                            displayTypewriter(locMsg);
                            speech.speak(locMsg);
                        },
                        () => {
                            const failMsg = "Boss, location permission block hai. Settings me allow karein.";
                            displayTypewriter(failMsg);
                            speech.speak(failMsg);
                        }
                    );
                }
                break;

            case 'FAKE_CALL':
                startFakeCallSequence(act.delay || 5, act.caller || 'Papa (Urgent)');
                break;

            case 'LIE_DETECTOR':
                sfx.playScanner();
                visualizer.setState('processing');
                break;

            case 'TIMER':
                startTimer(act.seconds || 30);
                if (isNative && window.AndroidBridge.setTimer) {
                    window.AndroidBridge.setTimer(act.seconds || 30, 'ANRU AI Timer');
                }
                break;

            case 'OPEN_SETTINGS':
                setTimeout(() => {
                    settingsBtn.click();
                }, 1000);
                break;
        }
    }

    // Flashlight Controller
    async function toggleTorch(turnOn) {
        try {
            if (turnOn) {
                if (!torchStream) {
                    torchStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' }
                    });
                }
                const track = torchStream.getVideoTracks()[0];
                await track.applyConstraints({ advanced: [{ torch: true }] });
            } else {
                if (torchStream) {
                    const track = torchStream.getVideoTracks()[0];
                    await track.applyConstraints({ advanced: [{ torch: false }] });
                    torchStream.getTracks().forEach(t => t.stop());
                    torchStream = null;
                }
            }
        } catch (e) {
            console.warn('Torch control error/not supported:', e);
        }
    }

    // Fake Emergency Call System
    function startFakeCallSequence(delaySeconds, callerName) {
        fakeCallerName.textContent = callerName;
        fakeCallerStatus.textContent = 'Incoming Call...';
        fakeCallDuration.style.display = 'none';

        setTimeout(() => {
            fakeCallOverlay.classList.add('active');
            sfx.startRingTone();
            if (navigator.vibrate) {
                navigator.vibrate([500, 250, 500, 250, 500]);
            }
        }, delaySeconds * 1000);
    }

    fakeCallDeclineBtn.addEventListener('click', () => {
        sfx.stopRingTone();
        fakeCallOverlay.classList.remove('active');
        if (activeCallDurationTimer) {
            clearInterval(activeCallDurationTimer);
            activeCallDurationTimer = null;
        }
    });

    fakeCallAcceptBtn.addEventListener('click', () => {
        sfx.stopRingTone();
        fakeCallerStatus.textContent = 'Connected (Call Active)';
        fakeCallDuration.style.display = 'block';
        fakeCallDuration.textContent = '00:01';

        let seconds = 1;
        activeCallDurationTimer = setInterval(() => {
            seconds++;
            const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
            const secs = String(seconds % 60).padStart(2, '0');
            fakeCallDuration.textContent = `${mins}:${secs}`;
        }, 1000);

        speech.speak("Hello Boss, urgent rescue call active. Aap situation se safely exit kar sakte hain.");
    });

    // Countdown Timer
    function startTimer(seconds) {
        let remaining = seconds;
        const interval = setInterval(() => {
            remaining--;
            orbStatusLabel.textContent = `TIMER // ${remaining}s`;
            if (remaining <= 0) {
                clearInterval(interval);
                orbStatusLabel.textContent = 'TIMER FINISHED!';
                sfx.playSiren();
                const finishMsg = "Boss, timer khatam ho gaya hai!";
                displayTypewriter(finishMsg);
                speech.speak(finishMsg);
            }
        }, 1000);
    }

    // Button Listeners
    micBtn.addEventListener('click', () => {
        triggerFirstInteraction();
        speech.toggleListening();
    });

    actionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            triggerFirstInteraction();
            const cmd = chip.getAttribute('data-cmd');
            userSpeechText.textContent = cmd;
            handleUserQuery(cmd);
        });
    });

    keyboardToggleBtn.addEventListener('click', () => {
        textInputDrawer.classList.toggle('open');
        if (textInputDrawer.classList.contains('open')) {
            manualInput.focus();
            keyboardToggleBtn.textContent = '❌ Close Input';
        } else {
            keyboardToggleBtn.textContent = '⌨️ Type Instead';
        }
    });

    manualSendBtn.addEventListener('click', () => {
        const val = manualInput.value.trim();
        if (val) {
            userSpeechText.textContent = val;
            manualInput.value = '';
            handleUserQuery(val);
        }
    });

    manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            manualSendBtn.click();
        }
    });

    sfxToggleBtn.addEventListener('click', () => {
        isSfxMuted = !isSfxMuted;
        sfx.setMuted(isSfxMuted);
        sfxToggleBtn.textContent = isSfxMuted ? '🔇' : '🔊';
    });

    settingsBtn.addEventListener('click', () => {
        inputBossName.value = brain.bossName;
        selectPersonality.value = brain.personality;
        selectLanguage.value = speech.language;
        renderContactsList();
        settingsModal.classList.add('open');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('open');
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('open');
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        const newBoss = inputBossName.value.trim() || 'Boss';
        brain.setBossName(newBoss);
        brain.setPersonality(selectPersonality.value);

        const newLang = selectLanguage.value;
        speech.setLanguage(newLang);

        updateTelemetry();
        settingsModal.classList.remove('open');

        const confirmMsg = `Settings saved! Namaste Boss ${newBoss}, main ready hoon.`;
        displayTypewriter(confirmMsg);
        speech.speak(confirmMsg);
        sfx.playResponse();
    });


    const toggleArcBubbleBtn = document.getElementById('toggleArcBubbleBtn');
    if (toggleArcBubbleBtn) {
        toggleArcBubbleBtn.addEventListener('click', () => {
            if (typeof window.AndroidBridge !== 'undefined' && window.AndroidBridge.toggleFloatingWidget) {
                window.AndroidBridge.toggleFloatingWidget();
            } else {
                alert('Floating Arc Reactor is available when installed as an Android APK.');
            }
        });
    }

    const openAccessBtn = document.getElementById('openAccessBtn');
    if (openAccessBtn) {
        openAccessBtn.addEventListener('click', () => {
            if (typeof window.AndroidBridge !== 'undefined' && window.AndroidBridge.openAccessibilitySettings) {
                window.AndroidBridge.openAccessibilitySettings();
            } else {
                alert('WhatsApp Auto-Send requires Android APK installation and Accessibility Service.');
            }
        });
    }

    window.addEventListener('online', () => {
        connStatus.textContent = 'ONLINE // SECURE';
        connStatus.style.color = '#10b981';
    });
    window.addEventListener('offline', () => {
        connStatus.textContent = 'OFFLINE // LOCAL BRAIN';
        connStatus.style.color = '#f59e0b';
    });
});
