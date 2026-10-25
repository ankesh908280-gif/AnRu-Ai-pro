// app.js - Master Controller for ANRU AI with Self-Learning Brain Studio & Single-File G-Drive Backup

document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new window.QuantumVisualizer('orbCanvas');
    const sfx = window.soundFX;
    const brain = new (window.AnruBrain || window.JarvisBrain)();
    const memory = window.anruMemory;

    // DOM Elements
    const micBtn = document.getElementById('micBtn');
    const orbStatusLabel = document.getElementById('orbStatusLabel');
    const userSpeechText = document.getElementById('userSpeechText');
    const jarvisResponseText = document.getElementById('jarvisResponseText');
    const connStatus = document.getElementById('connStatus');
    const memoryCountDisplay = document.getElementById('memoryCountDisplay');
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

    // Brain Studio Elements
    const brainStudioBtn = document.getElementById('brainStudioBtn');
    const brainStudioModal = document.getElementById('brainStudioModal');
    const closeBrainStudioBtn = document.getElementById('closeBrainStudioBtn');
    const statKnowledgeCount = document.getElementById('statKnowledgeCount');
    const statFactsCount = document.getElementById('statFactsCount');
    const statLastSync = document.getElementById('statLastSync');
    const downloadSingleBackupBtn = document.getElementById('downloadSingleBackupBtn');
    const uploadSingleBackupBtn = document.getElementById('uploadSingleBackupBtn');
    const importBrainFileInput = document.getElementById('importBrainFileInput');
    const teachQuestionInput = document.getElementById('teachQuestionInput');
    const teachAnswerInput = document.getElementById('teachAnswerInput');
    const teachSubmitBtn = document.getElementById('teachSubmitBtn');
    const bulkTrainTextarea = document.getElementById('bulkTrainTextarea');
    const bulkTrainBtn = document.getElementById('bulkTrainBtn');
    const gdriveWebhookInput = document.getElementById('gdriveWebhookInput');
    const syncToDriveBtn = document.getElementById('syncToDriveBtn');
    const pullFromDriveBtn = document.getElementById('pullFromDriveBtn');
    const brainStudioStatusMsg = document.getElementById('brainStudioStatusMsg');

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
    let activeCallDurationTimer = null;

    function updateTelemetry() {
        if (bossDisplay) bossDisplay.textContent = `BOSS: ${brain.bossName.toUpperCase()}`;
        if (voiceLangDisplay) voiceLangDisplay.textContent = (localStorage.getItem('jarvis_lang') || 'hi-IN').toUpperCase();
        if (typeof window.AndroidBridge !== 'undefined' && connStatus) {
            connStatus.textContent = 'SYSTEM // NATIVE APK';
            connStatus.style.color = '#00f2fe';
        }
        refreshBrainStatsUI();
    }

    function refreshBrainStatsUI() {
        if (!memory) return;
        const stats = memory.getStats();
        const total = stats.knowledgeCount + stats.factsCount;
        if (memoryCountDisplay) {
            memoryCountDisplay.textContent = `🧠 ${total} MEMORIES`;
        }
        if (statKnowledgeCount) statKnowledgeCount.textContent = String(stats.knowledgeCount);
        if (statFactsCount) statFactsCount.textContent = String(stats.factsCount);
        if (statLastSync) statLastSync.textContent = stats.lastSync;
    }

    if (memory && memory.initPromise) {
        memory.initPromise.then(() => refreshBrainStatsUI());
    }

    window.onNativeBridgeReady = function() {
        updateTelemetry();
        if (window.AndroidBridge && window.AndroidBridge.startForegroundService) {
            window.AndroidBridge.startForegroundService();
        }
    };
    updateTelemetry();

    function showStudioStatus(msg, isError = false) {
        if (!brainStudioStatusMsg) return;
        brainStudioStatusMsg.style.color = isError ? '#ef4444' : '#10b981';
        brainStudioStatusMsg.textContent = msg;
    }

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
        orbStatusLabel.textContent = 'PROCESSING // NEURAL BRAIN';
        visualizer.setState('processing');
        sfx.playProcessing();

        try {
            const result = await brain.processQuery(queryText);
            const answer = result.text;

            refreshBrainStatsUI();
            displayTypewriter(answer);
            sfx.playResponse();
            speech.speak(answer);

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

    function isAndroidBridgeActive() {
        return typeof window.AndroidBridge !== 'undefined' &&
               typeof window.AndroidBridge.isAndroid === 'function' &&
               window.AndroidBridge.isAndroid();
    }

    // --- Action Executor with Native Android & Web Fallbacks ---
    async function executeAction(act) {
        const isNative = isAndroidBridgeActive();

        switch (act.type) {
            case 'BRAIN_BACKUP':
                if (memory) {
                    memory.downloadSingleMasterBackupFile();
                    memory.syncToGoogleDriveSingleFile().catch(() => {});
                    refreshBrainStatsUI();
                }
                break;

            case 'OPEN_BRAIN_STUDIO':
                if (brainStudioBtn) {
                    setTimeout(() => brainStudioBtn.click(), 600);
                }
                break;

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

    // --- Brain Studio Listeners ---
    if (brainStudioBtn && brainStudioModal) {
        brainStudioBtn.addEventListener('click', () => {
            refreshBrainStatsUI();
            if (gdriveWebhookInput && memory) {
                gdriveWebhookInput.value = memory.getGDriveWebhookUrl();
            }
            showStudioStatus('');
            brainStudioModal.classList.add('open');
        });
    }

    if (closeBrainStudioBtn && brainStudioModal) {
        closeBrainStudioBtn.addEventListener('click', () => {
            brainStudioModal.classList.remove('open');
        });
        brainStudioModal.addEventListener('click', (e) => {
            if (e.target === brainStudioModal) {
                brainStudioModal.classList.remove('open');
            }
        });
    }

    // 1-Click Single File Master Backup Download
    if (downloadSingleBackupBtn && memory) {
        downloadSingleBackupBtn.addEventListener('click', () => {
            const stats = memory.downloadSingleMasterBackupFile();
            refreshBrainStatsUI();
            const msg = `Single Master Backup File (${stats.totalKnowledgeItems} Q&A, ${stats.totalPersonalFacts} Facts) downloaded!`;
            showStudioStatus(msg);
            sfx.playResponse();
            speech.speak("Boss, aapke ANRU AI ka pura data ek single file me download ho gaya hai.");
        });
    }

    // 1-Click Single File Restore / Smart Merge
    if (uploadSingleBackupBtn && importBrainFileInput && memory) {
        uploadSingleBackupBtn.addEventListener('click', () => {
            importBrainFileInput.click();
        });

        importBrainFileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const content = ev.target.result;
                    const res = await memory.bulkTrainFromTextOrJson(content);
                    refreshBrainStatsUI();
                    renderContactsList();
                    const msg = `Smart Merge Complete! +${res.added} Q&A & +${res.factsAdded} Facts restored with 0% data loss!`;
                    showStudioStatus(msg);
                    sfx.playResponse();
                    speech.speak(`Boss, backup file safaltapurvak merge ho gayi hai. Koi bhi purana data delete nahi hua!`);
                } catch (err) {
                    showStudioStatus('File format invalid!', true);
                }
                importBrainFileInput.value = '';
            };
            reader.readAsText(file);
        });
    }

    // Single Question-Answer Live Teaching in Studio
    if (teachSubmitBtn && memory) {
        teachSubmitBtn.addEventListener('click', async () => {
            const q = teachQuestionInput.value.trim();
            const a = teachAnswerInput.value.trim();
            if (!q || !a) {
                showStudioStatus('Sawal aur Jawab dono likhiye, Boss!', true);
                return;
            }
            await memory.learnQA(q, a, 'studio_taught');
            teachQuestionInput.value = '';
            teachAnswerInput.value = '';
            refreshBrainStatsUI();
            showStudioStatus(`Locked in Brain: "${q}"`);
            sfx.playResponse();
            speech.speak("Naya gyaan dimaag me lock ho gaya hai, Boss!");
        });
    }

    // Bulk Gemini Data Booster Training
    if (bulkTrainBtn && memory) {
        bulkTrainBtn.addEventListener('click', async () => {
            const raw = bulkTrainTextarea.value.trim();
            if (!raw) {
                showStudioStatus('Pehle Gemini se liya hua data paste karein!', true);
                return;
            }
            const res = await memory.bulkTrainFromTextOrJson(raw);
            bulkTrainTextarea.value = '';
            refreshBrainStatsUI();
            showStudioStatus(`Trained +${res.added} Q&A and +${res.factsAdded} Facts into Brain!`);
            sfx.playResponse();
            speech.speak(`Boss, ${res.added + res.factsAdded} nayi baatein mere dimaag me feed ho gayi hain!`);
        });
    }

    // Google Drive Cloud Webhook Sync
    if (syncToDriveBtn && memory) {
        syncToDriveBtn.addEventListener('click', async () => {
            if (gdriveWebhookInput) {
                memory.setGDriveWebhookUrl(gdriveWebhookInput.value);
            }
            if (!memory.getGDriveWebhookUrl()) {
                showStudioStatus('Pehle Google Apps Script URL dalein ya "Export 1-File Backup" dabayein!', true);
                return;
            }
            showStudioStatus('Syncing single master file to 4TB Google Drive...');
            const res = await memory.syncToGoogleDriveSingleFile();
            refreshBrainStatsUI();
            if (res.ok) {
                showStudioStatus(`Synced to single Google Drive file at ${res.time}!`);
                sfx.playResponse();
                speech.speak("Boss, Google Drive ki single file me sara data safe ho gaya hai.");
            } else {
                showStudioStatus('Cloud sync failed. Check URL or use Export 1-File button.', true);
            }
        });
    }

    if (pullFromDriveBtn && memory) {
        pullFromDriveBtn.addEventListener('click', async () => {
            if (gdriveWebhookInput) {
                memory.setGDriveWebhookUrl(gdriveWebhookInput.value);
            }
            if (!memory.getGDriveWebhookUrl()) {
                showStudioStatus('Pehle Google Apps Script URL dalein!', true);
                return;
            }
            showStudioStatus('Pulling & merging from Google Drive...');
            const res = await memory.pullFromGoogleDriveSingleFile();
            refreshBrainStatsUI();
            if (res.ok) {
                showStudioStatus(`Restored & merged from Google Drive (${res.time})!`);
                sfx.playResponse();
                speech.speak("Google Drive se sara data bina kisi data loss ke merge ho gaya hai!");
            } else {
                showStudioStatus('Could not pull from Drive. Check URL.', true);
            }
        });
    }

    // Main UI Button Listeners
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
        connStatus.textContent = 'ONLINE // AUTO-LEARNING';
        connStatus.style.color = '#10b981';
    });
    window.addEventListener('offline', () => {
        connStatus.textContent = 'OFFLINE // LOCAL BRAIN';
        connStatus.style.color = '#f59e0b';
    });
});
