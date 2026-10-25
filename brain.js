// brain.js - Self-Learning Human-Like Intelligence Engine with Context Memory & Auto-Harvester

class AnruBrain {
    constructor() {
        this.bossName = localStorage.getItem('jarvis_boss_name') || 'Boss';
        this.personality = localStorage.getItem('jarvis_personality') || 'savage';
        this.geminiApiKey = localStorage.getItem('jarvis_gemini_key') || '';
        this.lastUserQuestion = '';
        this.currentTopic = '';

        // VIP Contacts (Saved in localStorage)
        const savedContacts = localStorage.getItem('jarvis_contacts');
        this.contacts = savedContacts ? JSON.parse(savedContacts) : {
            'papa': '9876543210',
            'mummy': '9876543211',
            'bhai': '9876543212',
            'rahul': '9876543213',
            'dost': '9876543214'
        };
    }

    get memory() {
        return window.anruMemory || null;
    }

    setBossName(name) {
        if (!name || !name.trim()) return;
        this.bossName = name.trim();
        localStorage.setItem('jarvis_boss_name', this.bossName);
        if (this.memory) {
            this.memory.saveFact(`Boss ka naam ${this.bossName} hai`, 'boss_name', this.bossName);
        }
    }

    setPersonality(personality) {
        this.personality = personality;
        localStorage.setItem('jarvis_personality', personality);
    }

    setApiKey(key) {
        this.geminiApiKey = key ? key.trim() : '';
        localStorage.setItem('jarvis_gemini_key', this.geminiApiKey);
    }

    saveContact(name, phone) {
        if (!name || !phone) return;
        this.contacts[name.toLowerCase().trim()] = phone.trim();
        localStorage.setItem('jarvis_contacts', JSON.stringify(this.contacts));
        if (this.memory) {
            this.memory.triggerAutoCloudSync();
        }
    }

    getContacts() {
        return this.contacts;
    }

    normalize(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[.,#!$@\^&;:{}_`~()?]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // --- Resolve Pronouns & Follow-Up Questions Using Conversation Context ---
    resolveContextualQuery(query, rawQuery) {
        const pronounPatterns = /\b(uska|uski|uske|unka|unki|unhone|wahan|iska|iski|iske|unme|isme|aur batao|detail me batao|umar kya hai|age kya hai)\b/i;
        if (this.currentTopic && pronounPatterns.test(query) && query.split(' ').length <= 7) {
            if (!query.toLowerCase().includes(this.currentTopic.toLowerCase())) {
                return `${this.currentTopic} ${rawQuery}`;
            }
        }
        return rawQuery;
    }

    extractTopicFromQuery(rawQuery) {
        const cleaned = rawQuery
            .replace(/\b(kya hai|kya hota hai|kaun hai|kaun the|ke baare me batao|batao|explain karo|what is|who is|tell me about|kahan hai)\b/gi, '')
            .replace(/[?.,!]/g, '')
            .trim();
        if (cleaned.length >= 2 && cleaned.split(' ').length <= 5) {
            return cleaned;
        }
        return '';
    }

    async processQuery(rawQuery) {
        if (this.memory && this.memory.initPromise) {
            await this.memory.initPromise;
        }

        const query = this.normalize(rawQuery);

        // 0. Live Teaching, Fact Learning & Self-Correction Commands
        const learningResult = await this.handleLiveLearningAndMemory(query, rawQuery);
        if (learningResult) {
            await this.recordTurn(rawQuery, learningResult.text);
            return learningResult;
        }

        // 1. Action Commands (Call, WhatsApp, Apps, Torch, Location, Fake Call, Timer, Brain Backup)
        const actionResult = this.parseActionCommand(query, rawQuery);
        if (actionResult) {
            await this.recordTurn(rawQuery, actionResult.text);
            return actionResult;
        }

        // 2. Math Calculations (0-Latency Local Math Engine)
        const mathRes = this.evaluateMath(query, rawQuery);
        if (mathRes !== null) {
            const respText = `Boss, iska exact hisab hai: ${mathRes}`;
            await this.recordTurn(rawQuery, respText);
            return {
                text: respText,
                source: 'math_engine'
            };
        }

        // 3. Core Assistant Commands (Intro, Roasts, Identity, Time, Date, Battery, Memory Stats)
        const offlineCoreResp = await this.matchCoreIntents(query, rawQuery);
        if (offlineCoreResp) {
            await this.recordTurn(rawQuery, offlineCoreResp);
            return {
                text: offlineCoreResp,
                source: 'offline_core'
            };
        }

        // Resolve contextual follow-up (e.g. "unki age kya hai" -> "<lastTopic> unki age kya hai")
        const contextualRawQuery = this.resolveContextualQuery(query, rawQuery);
        const contextualNormQuery = this.normalize(contextualRawQuery);
        const detectedTopic = this.extractTopicFromQuery(rawQuery);
        if (detectedTopic) this.currentTopic = detectedTopic;

        // 4. Check Personal & Friends Facts Vault (Long-Term Personal Memory)
        if (this.memory) {
            const factMatch = this.memory.searchFacts(contextualNormQuery);
            if (factMatch) {
                const humanFactReply = `Boss, mujhe ache se yaad hai: ${factMatch.factText}.`;
                await this.recordTurn(rawQuery, humanFactReply, this.currentTopic);
                return {
                    text: humanFactReply,
                    source: 'personal_memory',
                    learned: false
                };
            }

            // 5. Check Self-Learning IndexedDB Knowledge Vault (Offline Learned + Seeded Q&A)
            const kMatch = this.memory.searchKnowledge(contextualNormQuery);
            if (kMatch && kMatch.confidence >= 0.68) {
                const reply = this.humanizeReply(kMatch.item.answer);
                await this.recordTurn(rawQuery, reply, this.currentTopic);
                this.lastUserQuestion = contextualRawQuery;
                return {
                    text: reply,
                    source: 'local_brain_db',
                    confidence: kMatch.confidence
                };
            }
        }

        // 6. Desi GK & Word Meaning Vault (Instant Built-in Vault)
        const desiGkResp = this.matchDesiGkVault(contextualNormQuery, contextualRawQuery);
        if (desiGkResp) {
            await this.recordTurn(rawQuery, desiGkResp, this.currentTopic);
            this.lastUserQuestion = contextualRawQuery;
            return {
                text: desiGkResp,
                source: 'desi_gk_vault'
            };
        }

        // 7. Optional Gemini API (If configured by user) + Auto-Save to Brain
        if (this.geminiApiKey) {
            try {
                const geminiResp = await this.queryGemini(contextualRawQuery);
                if (geminiResp) {
                    await this.autoHarvestToBrain(contextualRawQuery, geminiResp, 'gemini_learned');
                    await this.recordTurn(rawQuery, geminiResp, this.currentTopic);
                    this.lastUserQuestion = contextualRawQuery;
                    return { text: geminiResp, source: 'gemini', autoLearned: true };
                }
            } catch (err) {
                console.warn('Gemini API call failed, using Puter AI:', err);
            }
        }

        // 8. Free Puter.js AI with Full Conversation History & Personal Memory Context + Auto-Learn
        try {
            const puterResp = await this.queryPuterAI(contextualRawQuery);
            if (puterResp) {
                await this.autoHarvestToBrain(contextualRawQuery, puterResp, 'ai_harvested');
                await this.recordTurn(rawQuery, puterResp, this.currentTopic);
                this.lastUserQuestion = contextualRawQuery;
                return { text: puterResp, source: 'puter_ai', autoLearned: true };
            }
        } catch (err) {
            console.warn('Puter.js AI unavailable, falling back to Pollinations/Wikipedia:', err);
        }

        // 9. Pollinations Context-Aware Human AI + Auto-Learn
        try {
            const freeAiResp = await this.queryPollinationsAI(contextualRawQuery);
            if (freeAiResp) {
                await this.autoHarvestToBrain(contextualRawQuery, freeAiResp, 'ai_harvested');
                await this.recordTurn(rawQuery, freeAiResp, this.currentTopic);
                this.lastUserQuestion = contextualRawQuery;
                return { text: freeAiResp, source: 'pollinations_ai', autoLearned: true };
            }
        } catch (err) {}

        // 10. Dual Hindi & English Wikipedia Auto-Harvester
        try {
            const wikiResp = await this.queryWikipedia(contextualRawQuery);
            if (wikiResp) {
                await this.autoHarvestToBrain(contextualRawQuery, wikiResp, 'wikipedia_harvested');
                await this.recordTurn(rawQuery, wikiResp, this.currentTopic);
                this.lastUserQuestion = contextualRawQuery;
                return { text: wikiResp, source: 'wikipedia', autoLearned: true };
            }
        } catch (err) {
            console.warn('Wikipedia lookup failed:', err);
        }

        // 11. Conversational Human Fallback (Asks User to Teach It!)
        this.lastUserQuestion = rawQuery;
        const fallbackText = `Boss ${this.bossName}, "${rawQuery}" abhi meri offline memory me nahi hai aur internet se bhi connect nahi ho paya. Aap mujhe sikha dijiye—bas boliye "Iska sahi jawab [आपका जवाब] hai", main hamesha ke liye yaad rakh lunga!`;
        await this.recordTurn(rawQuery, fallbackText);
        return {
            text: fallbackText,
            source: 'fallback'
        };
    }

    // --- Live Voice Learning, Fact Extraction & Correction Engine ---
    async handleLiveLearningAndMemory(q, raw) {
        if (!this.memory) return null;

        // A. Direct Q&A Teaching: "jab koi puche X to bolna Y" / "agar main puchu X to jawab dena Y"
        const qaTeachMatch = raw.match(/(?:jab koi puche|agar koi puche|agar main puchu|sawal)\s+(.+?)\s+(?:toh bolna|to bolna|toh jawab dena|to jawab dena|ka jawab hai)\s+(.+)/i);
        if (qaTeachMatch && qaTeachMatch[1] && qaTeachMatch[2]) {
            const learnedQ = qaTeachMatch[1].trim();
            const learnedA = qaTeachMatch[2].trim();
            await this.memory.learnQA(learnedQ, learnedA, 'voice_taught');
            return {
                text: `Samajh gaya Boss! Maine apne dimaag me lock kar liya hai. Ab jab bhi koi "${learnedQ}" puchega, main bolunga: "${learnedA}".`,
                source: 'memory_learned',
                learned: true
            };
        }

        // B. Answer Correction: "galat jawab iska sahi jawab X hai" / "nahi iska answer X hai"
        const correctionMatch = raw.match(/(?:galat jawab|nahi galat|iska sahi jawab|sahi jawab|sahi answer)\s+(.+?)(?:\s+hai)?$/i);
        if (correctionMatch && correctionMatch[1] && this.lastUserQuestion) {
            const correctedAns = correctionMatch[1].replace(/\s+hai$/i, '').trim();
            await this.memory.learnQA(this.lastUserQuestion, correctedAns, 'user_correction');
            return {
                text: `Shukriya Boss! Maine apni galti sudhar li hai. "${this.lastUserQuestion}" ka sahi jawab ab hamesha ke liye "${correctedAns}" save ho gaya hai!`,
                source: 'memory_corrected',
                learned: true
            };
        }

        // C. Explicit Personal Fact Remembering: "yaad rakho ...", "remember that ...", "note kar lo ..."
        const rememberMatch = raw.match(/^(?:anru\s+)?(?:yaad rakho|yaad rakhna|remember that|remember|note kar lo|note karo|dimag me rakhna)\s*(?:ki|ke)?\s+(.+)/i);
        if (rememberMatch && rememberMatch[1]) {
            const fact = rememberMatch[1].trim();
            await this.memory.saveFact(fact, '', this.bossName);
            return {
                text: `Done Boss! Maine apni permanent memory me save kar liya hai: "${fact}". Ye baat main kabhi nahi bhulunga!`,
                source: 'fact_saved',
                learned: true
            };
        }

        // D. Implicit Friend / Personal Fact Detection ("mere dost X...", "mera birthday X...", "mujhe X pasand hai")
        const implicitFactMatch = raw.match(/^(mera birthday .+|meri age .+|mere dost .+ ka naam .+|mera dost .+ hai|mujhe .+ pasand hai|main .+ me rehta hoon|mera exam .+ ko hai)$/i);
        if (implicitFactMatch && implicitFactMatch[1] && !q.includes('kya') && !q.includes('kab') && !q.includes('kaun')) {
            const fact = implicitFactMatch[1].trim();
            await this.memory.saveFact(fact, '', this.bossName);
            return {
                text: `Wah Boss, acchi baat batayi aapne! Maine yaad rakh liya hai ki ${fact}.`,
                source: 'fact_saved',
                learned: true
            };
        }

        // E. Recall All Saved Memories Command
        if (this.includesAny(q, ['kya kya yaad hai', 'meri baatein batao', 'apni memory dikhao', 'tumhe mere baare me kya pata hai', 'what do you remember'])) {
            const stats = this.memory.getStats();
            const recentFacts = this.memory.factsCache.slice(-4).map(f => f.factText).join(', ');
            if (recentFacts) {
                return {
                    text: `Boss, mere dimaag me is waqt ${stats.knowledgeCount} sawal-jawab aur ${stats.factsCount} personal yaadein safe hain. Jaise mujhe yaad hai: ${recentFacts}.`,
                    source: 'memory_recall'
                };
            }
            return {
                text: `Boss, mere paas abhi ${stats.knowledgeCount} topics ka knowledge bank hai. Aap mujhe "Yaad rakho..." bolkar apni koi bhi personal baat sikha sakte hain!`,
                source: 'memory_recall'
            };
        }

        return null;
    }

    async autoHarvestToBrain(question, answer, sourceTag = 'internet_harvested') {
        if (!this.memory || !question || !answer) return;
        // Avoid saving error messages or tiny fragments
        if (answer.length < 10 || answer.includes('internet on rakhiye')) return;
        await this.memory.learnQA(question, answer, sourceTag);
    }

    async recordTurn(userText, anruText, topic = '') {
        if (!this.memory) return;
        await this.memory.addChatTurn('user', userText, topic);
        await this.memory.addChatTurn('anru', anruText, topic);
    }

    humanizeReply(text) {
        if (!text) return '';
        // Add subtle personality flavor if not already present
        if (this.personality === 'desi' && !text.toLowerCase().includes('boss') && !text.toLowerCase().includes('bhai')) {
            return `Dekho Boss, ${text}`;
        }
        return text;
    }

    // --- Action Parser ---
    parseActionCommand(q, raw) {
        // 0. BRAIN BACKUP / TRAIN STUDIO ACTION
        if (q.includes('brain backup') || q.includes('backup data') || q.includes('drive backup') || q.includes('data save karo')) {
            return {
                text: `Boss, aapka pura ANRU AI Brain ek single master file me backup kar raha hoon!`,
                source: 'action',
                action: { type: 'BRAIN_BACKUP' }
            };
        }

        if (q.includes('brain studio') || q.includes('train brain') || q.includes('dimag train karo')) {
            return {
                text: `Opening ANRU AI Brain Studio, Boss! Yahan se aap mujhe naya data de sakte hain aur Google Drive backup le sakte hain.`,
                source: 'action',
                action: { type: 'OPEN_BRAIN_STUDIO' }
            };
        }

        // 1. FAKE EMERGENCY CALL (Must be checked BEFORE generic call!)
        if (q.includes('fake call') || q.includes('emergency call') || q.includes('rescue me') || q.includes('mujhe call karo')) {
            return {
                text: `Emergency Rescue Mode armed. 5 second me incoming call aa rahi hai, Boss!`,
                source: 'action',
                action: { type: 'FAKE_CALL', delay: 5, caller: 'Papa (Urgent)' }
            };
        }

        // 2. AI LIE DETECTOR / BULLSHIT SCANNER
        if (q.includes('lie detector') || q.includes('sach bol raha hai ya jhooth') || q.includes('pol kholo') || q.includes('sach bol raha')) {
            const verdicts = [
                `Bio-Scan Complete: Voice frequencies me 98% fekugiri aur 2% sach detect hua hai. Report: Ye banda safed jhooth bol raha hai!`,
                `Scanning Complete: Inki heartbeat aur speech pattern me 100% bluff pakda gaya hai. Inse bolo pichhla udhaar pehle chukayein!`,
                `Polygraph Analysis: Shakal aur aawaz match nahi ho rahi. Dimaag 144p quality par jhooth fabricate kar raha hai!`,
                `Truth Scanner: Wah Boss! Inki baaton me sach ka ek katra bhi nahi hai, pura hava me teer chal raha hai!`
            ];
            const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];
            return {
                text: verdict,
                source: 'action',
                action: { type: 'LIE_DETECTOR' }
            };
        }

        // 3. FLASHLIGHT / TORCH
        if (q.includes('torch on') || q.includes('flashlight on') || q.includes('torch jalao') || q.includes('लाइट ऑन')) {
            return {
                text: `Flashlight ON kar di hai, Boss!`,
                source: 'action',
                action: { type: 'TORCH', state: 'on' }
            };
        }
        if (q.includes('torch off') || q.includes('flashlight off') || q.includes('torch band') || q.includes('लाइट बंद')) {
            return {
                text: `Flashlight OFF kar di hai, Boss!`,
                source: 'action',
                action: { type: 'TORCH', state: 'off' }
            };
        }

        // 4. PHONE CALL ACTION
        const isCallCmd = q.includes('call') || q.includes('kall') || q.includes('फोन लगाओ') || q.includes('कॉल करो');
        if (isCallCmd) {
            const numMatch = raw.match(/\b(\d{10})\b/);
            if (numMatch) {
                const number = numMatch[1];
                return {
                    text: `Connecting call to ${number}, Boss!`,
                    source: 'action',
                    action: { type: 'CALL', number: number, name: number }
                };
            }

            for (const [name, phone] of Object.entries(this.contacts)) {
                if (q.includes(name)) {
                    return {
                        text: `Connecting call to ${name.toUpperCase()}, Boss!`,
                        source: 'action',
                        action: { type: 'CALL', number: phone, name: name }
                    };
                }
            }

            const nameMatch = raw.match(/([a-zA-Z\u0900-\u097F]+)\s*(?:ko call|ko फोन)/i) ||
                              raw.match(/(?:call|phone)\s*([a-zA-Z\u0900-\u097F]+)/i);
            if (nameMatch && nameMatch[1]) {
                let targetName = nameMatch[1].toLowerCase().trim();
                if (!['lagao', 'karo', 'kijiye', 'bhai', 'please', 'fake'].includes(targetName)) {
                    const phone = this.contacts[targetName] || '';
                    if (phone) {
                        return {
                            text: `Connecting call to ${targetName.toUpperCase()}, Boss!`,
                            source: 'action',
                            action: { type: 'CALL', number: phone, name: targetName }
                        };
                    } else {
                        return {
                            text: `Boss, ${targetName} ka number contacts me nahi mila. Settings me ja kar number save kar lijiye.`,
                            source: 'action',
                            action: { type: 'OPEN_SETTINGS' }
                        };
                    }
                }
            }
        }

        // 5. WHATSAPP ACTION
        if (q.includes('whatsapp') || q.includes('व्हाट्सएप')) {
            let msg = raw
                .replace(/.*(?:whatsapp par bolo|whatsapp par message bhejo|whatsapp par bhejo|whatsapp message|whatsapp karo|whatsapp par likho)\s*/i, '')
                .replace(/.*(?:whatsapp)\s*/i, '')
                .trim();

            if (!msg) msg = "Hello from Boss!";

            let targetPhone = '';
            for (const [name, phone] of Object.entries(this.contacts)) {
                if (q.includes(name)) {
                    targetPhone = phone;
                    break;
                }
            }

            return {
                text: `Opening WhatsApp, Boss! Message तैयार है.`,
                source: 'action',
                action: { type: 'WHATSAPP', message: msg, phone: targetPhone }
            };
        }

        // 6. APP LAUNCHERS
        if (q.includes('youtube') || q.includes('यूट्यूब')) {
            const queryMatch = raw.match(/(?:youtube par|youtube me|youtube)\s*(?:search karo|gaana chalao|chalao|kholo)?\s*(.*)/i);
            let searchTopic = queryMatch && queryMatch[1] ? queryMatch[1].trim() : '';
            searchTopic = searchTopic.replace(/(gaana chalao|search karo|kholo|open karo)/gi, '').trim();

            if (searchTopic && searchTopic.length > 1) {
                return {
                    text: `YouTube par ${searchTopic} chala raha hoon, Boss!`,
                    source: 'action',
                    action: { type: 'OPEN_APP', app: 'youtube', query: searchTopic }
                };
            } else {
                return {
                    text: `Opening YouTube, Boss!`,
                    source: 'action',
                    action: { type: 'OPEN_APP', app: 'youtube' }
                };
            }
        }

        if (q.includes('instagram') || q.includes('इंस्टाग्राम')) {
            return {
                text: `Opening Instagram, Boss!`,
                source: 'action',
                action: { type: 'OPEN_APP', app: 'instagram' }
            };
        }

        if (q.includes('spotify') || q.includes('स्पॉटिफ़ाई')) {
            return {
                text: `Opening Spotify, Boss!`,
                source: 'action',
                action: { type: 'OPEN_APP', app: 'spotify' }
            };
        }

        if (q.includes('maps') || q.includes('rasta dikhao') || q.includes('रास्ता दिखाओ')) {
            let dest = raw
                .replace(/.*(?:maps par|maps me|rasta dikhao|navigation)\s*/i, '')
                .replace(/(kholo|open karo)/gi, '')
                .replace(/\s*ka rasta.*$/i, '')
                .trim();
            if (!dest) {
                const m = raw.match(/([a-zA-Z\u0900-\u097F]+)\s*ka rasta/i);
                if (m) dest = m[1].trim();
            }

            return {
                text: `Opening Google Maps for ${dest || 'Navigation'}, Boss!`,
                source: 'action',
                action: { type: 'OPEN_APP', app: 'maps', query: dest || 'Lucknow' }
            };
        }

        if (q.includes('google par search') || q.includes('google search')) {
            let term = raw.replace(/.*(?:google par search karo|google search karo|google search)\s*/i, '').trim();
            return {
                text: `Searching Google for ${term}, Boss!`,
                source: 'action',
                action: { type: 'OPEN_APP', app: 'google', query: term }
            };
        }

        // 7. TIMER
        const timerMatch = raw.match(/(\d+)\s*(?:second|sec|minute|min)\s*(?:ka timer|timer)/i) ||
                           raw.match(/timer\s*(?:lagao)?\s*(\d+)\s*(second|sec|minute|min)?/i);
        if (timerMatch) {
            let val = parseInt(timerMatch[1], 10);
            let unit = (timerMatch[2] || '').toLowerCase();
            let totalSeconds = unit.includes('min') ? val * 60 : val;
            return {
                text: `${val} ${unit.includes('min') ? 'minute' : 'second'} ka timer shuru kar diya hai, Boss!`,
                source: 'action',
                action: { type: 'TIMER', seconds: totalSeconds }
            };
        }

        // 8. GPS LOCATION
        if (q.includes('meri location') || q.includes('main kahan hoon') || q.includes('current location')) {
            return {
                text: `Boss, GPS satellites connect kar raha hoon. Aapki live location screen par aa rahi hai.`,
                source: 'action',
                action: { type: 'LOCATION' }
            };
        }

        // 9. SYSTEM ALARM
        if (q.includes('alarm') || q.includes('अलार्म')) {
            const timeMatch = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|am|pm|बजे)?/i);
            let hour = 6;
            let minute = 0;
            if (timeMatch && timeMatch[1]) {
                hour = parseInt(timeMatch[1], 10);
                if (timeMatch[2]) minute = parseInt(timeMatch[2], 10);
                if (q.includes('sham') || q.includes('raat') || q.includes('pm')) {
                    if (hour < 12) hour += 12;
                }
            }
            const minStr = String(minute).padStart(2, '0');
            return {
                text: `${hour}:${minStr} ka alarm set kar diya hai, Boss!`,
                source: 'action',
                action: { type: 'ALARM', hour: hour, minute: minute, message: 'ANRU AI Wakeup Call' }
            };
        }

        // 10. SYSTEM VOLUME & SOUND
        if (q.includes('volume') || q.includes('आवाज') || q.includes('aawaz')) {
            let percent = 70;
            const pctMatch = raw.match(/(\d+)\s*(?:percent|%|प्रतिशत)/i);
            if (pctMatch) {
                percent = parseInt(pctMatch[1], 10);
            } else if (q.includes('full') || q.includes('100') || q.includes('tez') || q.includes('badhao')) {
                percent = 100;
            } else if (q.includes('kam') || q.includes('dheemi') || q.includes('low')) {
                percent = 30;
            } else if (q.includes('mute') || q.includes('silent') || q.includes('band')) {
                percent = 0;
            }
            return {
                text: `Volume ${percent} percent set kar diya hai, Boss!`,
                source: 'action',
                action: { type: 'VOLUME', percent: percent }
            };
        }

        // 11. FLOATING SCI-FI ARC REACTOR WIDGET
        if (q.includes('floating') || q.includes('फ्लोटिंग') || q.includes('bubble') || q.includes('overlay')) {
            return {
                text: `Floating Arc Reactor screen widget toggle kar diya hai, Boss!`,
                source: 'action',
                action: { type: 'FLOATING_WIDGET' }
            };
        }

        // 12. ACCESSIBILITY SETTINGS
        if (q.includes('accessibility') || q.includes('auto send setting') || q.includes('auto whatsapp')) {
            return {
                text: `Opening Accessibility Settings. ANRU AI service ko enable karein taaki Auto-Send kaam kare!`,
                source: 'action',
                action: { type: 'ACCESSIBILITY_SETTINGS' }
            };
        }

        // 13. UNIVERSAL INSTALLED APP LAUNCHER
        const appLaunchMatch = raw.match(/([a-zA-Z0-9\u0900-\u097F]+)\s*(?:app|kholo|open karo|open|chalao|start karo|kholiye)/i);
        if (appLaunchMatch && appLaunchMatch[1]) {
            let targetApp = appLaunchMatch[1].trim().toLowerCase();
            const blacklist = ['torch', 'flashlight', 'light', 'whatsapp', 'call', 'timer', 'alarm', 'volume', 'location', 'fake', 'lie', 'pol', 'brain', 'memory'];
            if (!blacklist.includes(targetApp) && targetApp.length >= 2) {
                return {
                    text: `Launching ${targetApp.toUpperCase()}, Boss!`,
                    source: 'action',
                    action: { type: 'OPEN_APP', app: targetApp }
                };
            }
        }

        return null;
    }

    // --- Core Assistant Intents ---
    async matchCoreIntents(q, raw) {
        const boss = this.bossName;

        if (this.includesAny(q, ['who are you', 'tum kaun ho', 'introduce yourself', 'apna intro do', 'apna parichay', 'kaun ho tum', 'what is your name', 'tera naam kya hai'])) {
            const memCount = this.memory ? this.memory.getStats().knowledgeCount : 50;
            return `Namaste! Mera naam ANRU AI hai. Mujhe mere Boss ${boss} ne design kiya hai. Mere paas khud ka Self-Learning Memory Brain hai jisme abhi ${memCount} topics store hain, aur main aapki har baat yaad rakhta hoon!`;
        }

        if (this.includesAny(q, ['who made you', 'kisne banaya', 'tumhe kisne banaya', 'tera boss kaun hai', 'who is your boss', 'kiska app hai', 'creator kaun hai'])) {
            return `Mujhe mere Boss ${boss} ne banaya hai. Main unka personal Self-Learning AI assistant hoon jo har roz unse aur unke doston se nayi baatein seekhta rehta hai!`;
        }

        const changeNameMatch = raw.match(/(?:mera naam|set boss name to|mera name)\s+([a-zA-Z\u0900-\u097F]+)/i);
        if (changeNameMatch && changeNameMatch[1]) {
            const newName = changeNameMatch[1].trim();
            this.setBossName(newName);
            return `Done! Ab se main aapko Boss ${newName} ke naam se pehchaanunga aur apni permanent memory me bhi update kar liya hai.`;
        }

        if (this.includesAny(q, ['roast karo', 'dost ko roast', 'mere dost ko kuch bolo', 'isko roast', 'roast my friend', 'insult karo', 'kuch funny bolo dost', 'isko sunao', 'dost ki beizzati'])) {
            const roasts = [
                `Aapke dost ko dekh kar lagta hai inka dimaag flight mode par rehta hai. Jab zaroorat hoti hai tab network hi gayab!`,
                `Inse boliye thoda kam muskuraayein. Bina kisi achievement ke itna glow sirf street light karti hai!`,
                `Aapke dost ki baatein sunkar lagta hai, inka dimaag abhi trial version par hai, full version khareedne ke paise nahi the!`,
                `Inka dimaag 2G network par chal raha hai aur yeh hamare 5G ke zamane me gyaan de rahe hain!`,
                `Bhai inko bol do selfie lete waqt camera saaf kar liya karein, phone ka AI filter bhi confuse ho jata hai!`
            ];
            return roasts[Math.floor(Math.random() * roasts.length)];
        }

        if (this.includesAny(q, ['taarif karo', 'meri taarif', 'kuch accha bolo', 'compliment me', 'praise me'])) {
            return `Boss ${boss}, aapki intelligence aur tech swag ka koi muqabala nahi hai. Khud ka Self-Learning AI banana har kisi ke bas ki baat nahi hoti!`;
        }

        if (this.includesAny(q, ['shayari sunao', 'kuch shayari', 'attitude shayari', 'shayari'])) {
            const shayaris = [
                `Hunar toh sabhi me hota hai, par chamakta wahi hai jo mehnat karta hai. Aur Boss ${boss} ka swag toh alag hi level ka hai!`,
                `Manzil unhi ko milti hai jinke sapno me jaan hoti hai, pankho se kuch nahi hota hauslo se udaan hoti hai!`,
                `Rukh badal dete hain hum un hawaon ka, jisme chalne ka hausla kisi aam insaan me nahi hota!`
            ];
            return shayaris[Math.floor(Math.random() * shayaris.length)];
        }

        if (this.includesAny(q, ['chutkula', 'joke', 'koi joke sunao', 'hansa do', 'funny'])) {
            const jokes = [
                `Ek baar phone ne charger se poocha: Tum roz mujhe itna current kyu dete ho? Charger bola: Taaki tu pura din reel dekh kar mera ehsaan na bhoole!`,
                `Master ji ne poocha: Sabse bada andhera kahan hota hai? Pappu bola: Wi-Fi band hone ke baad ghar ke andar!`
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }

        if (this.includesAny(q, ['kya time hua', 'time kya hai', 'time batao', 'current time', 'what time is it'])) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            return `Boss, abhi waqt ho raha hai ${timeStr}.`;
        }

        if (this.includesAny(q, ['konsi date hai', 'aaj ki date', 'aaj konsa din hai', 'today date', 'current date'])) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('hi-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            return `Boss, aaj ka din aur taareekh hai: ${dateStr}.`;
        }

        if (this.includesAny(q, ['battery kitni hai', 'battery status', 'charge kitna hai', 'battery percentage'])) {
            if (navigator.getBattery) {
                try {
                    const battery = await navigator.getBattery();
                    const level = Math.round(battery.level * 100);
                    const charging = battery.charging ? 'aur phone charge ho raha hai.' : 'aur battery normal chal rahi hai.';
                    return `Boss, phone ki battery ${level} percent hai, ${charging}`;
                } catch (e) {}
            }
            return `Boss, battery status check karne ke liye system ready hai. All systems nominal!`;
        }

        if (this.includesAny(q, ['system status', 'sab theek hai', 'how are you', 'kaise ho', 'kya haal hai'])) {
            const stats = this.memory ? this.memory.getStats() : { knowledgeCount: 0, factsCount: 0 };
            return `Main bilkul badiya hoon Boss ${boss}! Mera Self-Learning Brain active hai (${stats.knowledgeCount} Q&A aur ${stats.factsCount} personal yaadein safe hain). Bataiye aaj kya baat karein?`;
        }

        return null;
    }

    // --- Desi GK & Word Meaning Vault ---
    matchDesiGkVault(q, raw) {
        const lower = (q + ' ' + raw).toLowerCase();

        if (lower.includes('pradhanmantri') || lower.includes('प्रधानमंत्री') || lower.includes('prime minister')) {
            this.currentTopic = 'Narendra Modi';
            return `Bharat ke Pradhan Mantri Shri Narendra Modi hain.`;
        }
        if (lower.includes('rashtrapati') || lower.includes('राष्ट्रपति') || lower.includes('president of india')) {
            this.currentTopic = 'Droupadi Murmu';
            return `Bharat ki Rashtrapati Smt. Droupadi Murmu hain.`;
        }
        if (lower.includes('uttar pradesh') || lower.includes('up ke') || lower.includes('उत्तर प्रदेश')) {
            if (lower.includes('mukhyamantri') || lower.includes('मुख्यमंत्री') || lower.includes('cm')) {
                this.currentTopic = 'Yogi Adityanath';
                return `Uttar Pradesh ke Mukhya Mantri Shri Yogi Adityanath hain.`;
            }
        }
        if (lower.includes('bihar') || lower.includes('बिहार')) {
            if (lower.includes('mukhyamantri') || lower.includes('मुख्यमंत्री') || lower.includes('cm')) {
                this.currentTopic = 'Nitish Kumar';
                return `Bihar ke Mukhya Mantri Shri Nitish Kumar hain.`;
            }
        }
        if (lower.includes('bharat ki rajdhani') || lower.includes('capital of india') || lower.includes('भारत की राजधानी')) {
            this.currentTopic = 'New Delhi';
            return `Bharat ki rajdhani New Delhi hai.`;
        }
        if (lower.includes('up ki rajdhani') || lower.includes('uttar pradesh ki rajdhani')) {
            this.currentTopic = 'Lucknow';
            return `Uttar Pradesh ki rajdhani Lucknow hai.`;
        }
        if (lower.includes('google ka ceo') || lower.includes('ceo of google')) {
            this.currentTopic = 'Sundar Pichai';
            return `Google ke CEO Sundar Pichai hain, jo Indian-origin ke globally renowned tech leader hain.`;
        }
        if (lower.includes('chand par pehla') || lower.includes('chand par kaun') || lower.includes('first person on moon')) {
            this.currentTopic = 'Neil Armstrong';
            return `Chand par sabse pehla kadam Neil Armstrong ne saal 1969 me Apollo 11 mission ke dauran rakha tha.`;
        }

        const meaningMatch = raw.match(/([a-zA-Z]+)\s*(?:ka matlab|ka hindi meaning|meaning in hindi|ka arth)/i);
        if (meaningMatch && meaningMatch[1]) {
            const word = meaningMatch[1].toLowerCase();
            const dict = {
                'generative': 'Nirmaankari ya naya banane wala',
                'intelligence': 'Buddhimatta ya samajhdaari',
                'artificial': 'Kritrim ya banawati',
                'assistant': 'Sahayak ya madadgaar',
                'developer': 'Vikaaskarta ya software banane wala',
                'explore': 'Khoj karna ya naye cheezon ko dekhna',
                'achieve': 'Haasil karna ya paana',
                'freedom': 'Azaadi ya swatantrata',
                'knowledge': 'Gyaan ya jaankari'
            };
            if (dict[word]) {
                return `"${word}" ka Hindi me matlab hota hai: ${dict[word]}.`;
            }
        }

        return null;
    }

    // --- Math Engine ---
    evaluateMath(q, raw) {
        try {
            const pctMatch1 = q.match(/(\d+(?:\.\d+)?)\s*(?:ka|of)\s*(\d+(?:\.\d+)?)\s*(?:percent|pratishat|%)/i);
            if (pctMatch1) {
                const total = parseFloat(pctMatch1[1]);
                const rate = parseFloat(pctMatch1[2]);
                const val = (total * rate) / 100;
                return `${val % 1 === 0 ? val : val.toFixed(2)}`;
            }

            const pctMatch2 = q.match(/(\d+(?:\.\d+)?)\s*(?:percent|pratishat|%)\s*(?:ka|of)\s*(\d+(?:\.\d+)?)/i);
            if (pctMatch2) {
                const rate = parseFloat(pctMatch2[1]);
                const total = parseFloat(pctMatch2[2]);
                const val = (total * rate) / 100;
                return `${val % 1 === 0 ? val : val.toFixed(2)}`;
            }

            const sqrtMatch = q.match(/(?:square root of|under root of|\bsqrt\b)\s*(\d+(?:\.\d+)?)/i) ||
                              q.match(/(\d+(?:\.\d+)?)\s*(?:ka square root|ka under root)/i);
            if (sqrtMatch) {
                const num = parseFloat(sqrtMatch[1]);
                const root = Math.sqrt(num);
                return `${root % 1 === 0 ? root : root.toFixed(2)}`;
            }

            let cleanExpr = q
                .replace(/plus|jod|aur/gi, '+')
                .replace(/minus|ghatao|kam karo/gi, '-')
                .replace(/into|guna|times/gi, '*')
                .replace(/divided by|divide by|bhag/gi, '/');

            const mathPattern = /(\d+(?:\.\d+)?(?:\s*[\+\-\*\/]\s*\d+(?:\.\d+)?)+)/;
            const match = cleanExpr.match(mathPattern);
            if (match) {
                const expr = match[1].replace(/\s+/g, '');
                if (/^[\d\+\-\*\/\.]+$/.test(expr)) {
                    const computed = Function(`'use strict'; return (${expr})`)();
                    if (typeof computed === 'number' && !isNaN(computed) && isFinite(computed)) {
                        return `${computed % 1 === 0 ? computed : computed.toFixed(2)}`;
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    // --- Build Human-Like Context Prompt with Personal Memory + Chat History ---
    buildContextualSystemPrompt(userPrompt) {
        const factsText = this.memory ? this.memory.getPersonalFactsSummary(15) : '';
        const recentTurns = this.memory ? this.memory.getRecentConversationContext(6) : [];
        const historyText = recentTurns
            .map(t => `${t.role === 'user' ? 'User' : 'ANRU AI'}: ${t.text}`)
            .join('\n');

        let toneGuide = 'friendly, warm, witty, and natural like a real human best friend';
        if (this.personality === 'savage') {
            toneGuide = 'charismatic, witty, slightlydesi-swag, and super smart like a close friend';
        } else if (this.personality === 'formal') {
            toneGuide = 'polite, intelligent, and respectful like Tony Stark\'s AI';
        }

        return `You are ANRU AI, a real human-like personal AI companion created by Boss ${this.bossName}.
Personality & Tone: ${toneGuide}.
Speak in natural conversational Hinglish (Hindi written in English script or simple Hindi).
Keep your response concise (1 to 3 sentences) so it sounds natural when spoken aloud. Never use markdown asterisks (*).

${factsText ? `Personal Facts You Remember About Boss & Friends:\n${factsText}\n` : ''}
${historyText ? `Recent Conversation History:\n${historyText}\n` : ''}
Current User Message: ${userPrompt}
ANRU AI:`;
    }

    // --- Puter.js Zero-API-Key Free AI (Context-Aware) ---
    async queryPuterAI(userPrompt) {
        if (typeof window.puter === 'undefined' || !window.puter.ai) {
            return null;
        }

        const fullPrompt = this.buildContextualSystemPrompt(userPrompt);
        const responsePromise = window.puter.ai.chat(fullPrompt);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Puter AI timeout')), 8500)
        );

        const res = await Promise.race([responsePromise, timeoutPromise]);

        let out = '';
        if (typeof res === 'string') {
            out = res;
        } else if (res && res.message && res.message.content) {
            out = res.message.content;
        } else if (res && res.text) {
            out = res.text;
        }

        if (out && out.trim()) {
            return out.trim().replace(/[\*\#\_]/g, '').replace(/^anru ai:\s*/i, '');
        }
        return null;
    }

    // --- Pollinations Human-Like AI with Memory Context ---
    async queryPollinationsAI(userPrompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7500);

        const fullPrompt = this.buildContextualSystemPrompt(userPrompt);
        const url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai&seed=42`;

        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const text = await res.text();
                if (text && text.trim()) {
                    return text.trim()
                        .replace(/[\*\#\_]/g, '')
                        .replace(/^(anru ai|jarvis):\s*/i, '');
                }
            }
        } catch (e) {
            clearTimeout(timeoutId);
        }
        return null;
    }

    // --- Dual Hindi & English Wikipedia Harvester ---
    async queryWikipedia(userPrompt) {
        let topic = userPrompt
            .replace(/(kya hai|kya hota hai|kaun hai|explain karo|batao|what is|who is|kisko bolte hain|bataiye|ke baare me batao)/gi, '')
            .trim();

        if (!topic || topic.length < 2) return null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
            const hiSearchUrl = `https://hi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`;
            const hiRes = await fetch(hiSearchUrl, { signal: controller.signal });
            if (hiRes.ok) {
                const hiData = await hiRes.json();
                if (hiData.query && hiData.query.search && hiData.query.search.length > 0) {
                    const snippet = hiData.query.search[0].snippet.replace(/<[^>]*>?/gm, '');
                    if (snippet && snippet.length > 15) {
                        clearTimeout(timeoutId);
                        this.currentTopic = topic;
                        return `Boss, ${topic} ke baare me: ${snippet.split('. ')[0]}.`;
                    }
                }
            }

            const enSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
            const enRes = await fetch(enSummaryUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (enRes.ok) {
                const enData = await enRes.json();
                if (enData.extract) {
                    const firstSentence = enData.extract.split('. ')[0] + '.';
                    this.currentTopic = topic;
                    return `Boss, ${topic} ke baare me: ${firstSentence}`;
                }
            }
        } catch (e) {
            clearTimeout(timeoutId);
        }
        return null;
    }

    // --- Gemini Flash (If key provided) ---
    async queryGemini(userPrompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
        const fullPrompt = this.buildContextualSystemPrompt(userPrompt);

        const payload = {
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.75, maxOutputTokens: 150 }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Gemini status ${res.status}`);
        const data = await res.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
            return candidateText.trim().replace(/[\*\#\_]/g, '');
        }
        return null;
    }

    includesAny(text, phrases) {
        return phrases.some(p => text.includes(p));
    }
}

window.AnruBrain = AnruBrain;
window.JarvisBrain = AnruBrain;
