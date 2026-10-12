// brain.js - Master Intelligence Engine with Actions, Hardware & AI

class AnruBrain {
    constructor() {
        this.bossName = localStorage.getItem('jarvis_boss_name') || 'Boss';
        this.personality = localStorage.getItem('jarvis_personality') || 'savage';
        this.geminiApiKey = localStorage.getItem('jarvis_gemini_key') || '';
        
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

    setBossName(name) {
        if (!name || !name.trim()) return;
        this.bossName = name.trim();
        localStorage.setItem('jarvis_boss_name', this.bossName);
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
    }

    getContacts() {
        return this.contacts;
    }

    normalize(text) {
        return text
            .toLowerCase()
            .replace(/[.,#!$@\^&;:{}_\`\~()?]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async processQuery(rawQuery) {
        const query = this.normalize(rawQuery);

        // 1. Action Commands (Call, WhatsApp, Apps, Torch, Location, Fake Call, Timer)
        const actionResult = this.parseActionCommand(query, rawQuery);
        if (actionResult) {
            return actionResult;
        }

        // 2. Math Calculations (0-Latency Local Math Engine)
        const mathRes = this.evaluateMath(query, rawQuery);
        if (mathRes !== null) {
            return {
                text: `Boss, iska hisab hai: ${mathRes}`,
                source: 'math_engine'
            };
        }

        // 3. Core Assistant Commands (Intro, Roasts, Identity, Time, Date, Battery)
        const offlineCoreResp = await this.matchCoreIntents(query, rawQuery);
        if (offlineCoreResp) {
            return {
                text: offlineCoreResp,
                source: 'offline_core'
            };
        }

        // 4. Desi GK & Word Meaning Vault (Instant offline knowledge)
        const desiGkResp = this.matchDesiGkVault(query, rawQuery);
        if (desiGkResp) {
            return {
                text: desiGkResp,
                source: 'desi_gk_vault'
            };
        }

        // 5. Optional Gemini API (If configured)
        if (this.geminiApiKey) {
            try {
                const geminiResp = await this.queryGemini(rawQuery);
                if (geminiResp) {
                    return { text: geminiResp, source: 'gemini' };
                }
            } catch (err) {
                console.warn('Gemini API call failed, falling back to Puter AI:', err);
            }
        }

        // 6. Free Puter.js AI (No API Key Required!)
        try {
            const puterResp = await this.queryPuterAI(rawQuery);
            if (puterResp) {
                return { text: puterResp, source: 'puter_ai' };
            }
        } catch (err) {
            console.warn('Puter.js AI failed or loading, falling back to Hindi Wikipedia:', err);
        }

        // 7. Dual Hindi & English Wikipedia Search
        try {
            const wikiResp = await this.queryWikipedia(rawQuery);
            if (wikiResp) {
                return { text: wikiResp, source: 'wikipedia' };
            }
        } catch (err) {
            console.warn('Wikipedia lookup failed:', err);
        }

        // 8. Pollinations AI Fallback
        try {
            const freeAiResp = await this.queryPollinationsAI(rawQuery);
            if (freeAiResp) {
                return { text: freeAiResp, source: 'pollinations_ai' };
            }
        } catch (err) {}

        // 9. Intelligent Fallback
        return {
            text: `Boss ${this.bossName}, maine "${rawQuery}" suna. Iska answer paane ke liye internet on rakhiye ya mujhse Call, WhatsApp ya koi calculation karne ko boliye!`,
            source: 'fallback'
        };
    }

    // --- Action Parser ---
    parseActionCommand(q, raw) {
        const boss = this.bossName;

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
            // Check direct 10-digit number in query
            const numMatch = raw.match(/\b(\d{10})\b/);
            if (numMatch) {
                const number = numMatch[1];
                return {
                    text: `Connecting call to ${number}, Boss!`,
                    source: 'action',
                    action: { type: 'CALL', number: number, name: number }
                };
            }

            // Check contact name in query
            for (const [name, phone] of Object.entries(this.contacts)) {
                if (q.includes(name)) {
                    return {
                        text: `Connecting call to ${name.toUpperCase()}, Boss!`,
                        source: 'action',
                        action: { type: 'CALL', number: phone, name: name }
                    };
                }
            }

            // Extract target name if after "call" or before "ko call"
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
                action: { type: 'OPEN_APP', app: 'maps', query: dest || 'Kanpur' }
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

        // 7. TIMER / ALARM
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

        
        // 9. SYSTEM ALARM (Android Native)
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

        // 10. SYSTEM VOLUME & SOUND (Android Native)
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

        // 12. ACCESSIBILITY SETTINGS (For Auto-WhatsApp)
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
            const blacklist = ['torch', 'flashlight', 'light', 'whatsapp', 'call', 'timer', 'alarm', 'volume', 'location', 'fake', 'lie', 'pol'];
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
            return `Namaste! Mera naam ANRU AI hai. Mujhe mere Boss ${boss} ne design kiya hai. Main ek advanced voice AI hoon jo aapke bolne par Call, WhatsApp, YouTube, Flashlight aur sawalon ke jawab deta hai. Boliye, kya command hai?`;
        }

        if (this.includesAny(q, ['who made you', 'kisne banaya', 'tumhe kisne banaya', 'tera boss kaun hai', 'who is your boss', 'kiska app hai', 'creator kaun hai'])) {
            return `Mujhe mere Boss ${boss} ne phone par coding logic aur AI prompt engineering ka use karke build kiya hai. Boss ${boss} ke aage koi bol sakta hai kya!`;
        }

        const changeNameMatch = raw.match(/(?:mera naam|set boss name to|mera name)\s+([a-zA-Z\u0900-\u097F]+)/i);
        if (changeNameMatch && changeNameMatch[1]) {
            const newName = changeNameMatch[1].trim();
            this.setBossName(newName);
            return `Done! Ab se main aapko Boss ${newName} ke naam se pehchaanunga.`;
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
            return `Boss ${boss}, aapki intelligence aur tech swag ka koi muqabala nahi hai. Phone se itna powerful voice AI app live kar dena har kisi ke bas ki baat nahi hoti!`;
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
                } catch(e) {}
            }
            return `Boss, battery status check karne ke liye system ready hai. All systems nominal!`;
        }

        if (this.includesAny(q, ['system status', 'sab theek hai', 'how are you', 'kaise ho', 'kya haal hai'])) {
            return `All systems operational, Boss! Call actions, WhatsApp messenger aur visualizer fully ready hain.`;
        }

        return null;
    }

    // --- Desi GK & Word Meaning Vault ---
    matchDesiGkVault(q, raw) {
        const lower = (q + ' ' + raw).toLowerCase();

        if (lower.includes('pradhanmantri') || lower.includes('प्रधानमंत्री') || lower.includes('prime minister')) {
            return `Bharat ke Pradhan Mantri Shri Narendra Modi hain.`;
        }
        if (lower.includes('rashtrapati') || lower.includes('राष्ट्रपति') || lower.includes('president of india')) {
            return `Bharat ki Rashtrapati Smt. Droupadi Murmu hain.`;
        }
        if (lower.includes('uttar pradesh') || lower.includes('up ke') || lower.includes('उत्तर प्रदेश')) {
            if (lower.includes('mukhyamantri') || lower.includes('मुख्यमंत्री') || lower.includes('cm')) {
                return `Uttar Pradesh ke Mukhya Mantri Shri Yogi Adityanath hain.`;
            }
        }
        if (lower.includes('bihar') || lower.includes('बिहार')) {
            if (lower.includes('mukhyamantri') || lower.includes('मुख्यमंत्री') || lower.includes('cm')) {
                return `Bihar ke Mukhya Mantri Shri Nitish Kumar hain.`;
            }
        }
        if (lower.includes('bharat ki rajdhani') || lower.includes('capital of india') || lower.includes('भारत की राजधानी')) {
            return `Bharat ki rajdhani New Delhi hai.`;
        }
        if (lower.includes('up ki rajdhani') || lower.includes('uttar pradesh ki rajdhani')) {
            return `Uttar Pradesh ki rajdhani Lucknow hai.`;
        }
        if (lower.includes('generative ai') || lower.includes('जेनेरेटिव आई') || lower.includes('जनरेटिव एआई')) {
            return `Generative AI ek aisi technology hai jo naye text, images, code aur audio ko bina insani madad ke khud generate kar sakti hai.`;
        }
        if (lower.includes('ai kya hai') || lower.includes('artificial intelligence') || lower.includes('एआई क्या है')) {
            return `Artificial Intelligence machine ko insani dimaag ki tarah seekhne aur smart decision lene ki taqat deta hai, jaise main aapke sath live baat kar raha hoon!`;
        }
        if (lower.includes('google ka ceo') || lower.includes('ceo of google')) {
            return `Google ke CEO Sundar Pichai hain, jo Indian-origin ke globally renowned tech visionary hain.`;
        }
        if (lower.includes('chand par pehla') || lower.includes('chand par kaun') || lower.includes('moon')) {
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
        } catch(e) {}
        return null;
    }

    // --- Puter.js Zero-API-Key Free AI ---
    async queryPuterAI(userPrompt) {
        if (typeof window.puter === 'undefined' || !window.puter.ai) {
            return null;
        }

        const systemPrompt = `You are ANRU AI, a charismatic Indian AI voice assistant created by Boss ${this.bossName}.
Respond in conversational Hindi / Hinglish. Keep answers strictly 1-2 sentences so they are read aloud cleanly.
Be helpful, clever and polite. Never use markdown asterisks or bullet points.`;

        const fullPrompt = `${systemPrompt}\n\nUser: ${userPrompt}\nJarvis:`;

        const responsePromise = window.puter.ai.chat(fullPrompt);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Puter AI timeout')), 9000)
        );

        const res = await Promise.race([responsePromise, timeoutPromise]);

        if (typeof res === 'string') {
            return res.trim().replace(/[\*\#\_]/g, '');
        } else if (res && res.message && res.message.content) {
            return res.message.content.trim().replace(/[\*\#\_]/g, '');
        } else if (res && res.text) {
            return res.text.trim().replace(/[\*\#\_]/g, '');
        }
        return null;
    }

    // --- Dual Hindi & English Wikipedia Search ---
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
                    return `Boss, ${topic} ke baare me: ${firstSentence}`;
                }
            }
        } catch(e) {
            clearTimeout(timeoutId);
        }
        return null;
    }

    // --- Pollinations AI Fallback ---
    async queryPollinationsAI(userPrompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7500);

        const systemPrompt = `You are ANRU AI, an ultra-smart Indian voice assistant created by Boss ${this.bossName}.
Speak in conversational Hinglish or simple Hindi. Answer strictly 1 to 2 sentences. No asterisks or formatting.`;

        const fullPrompt = `${systemPrompt}\n\nUser: ${userPrompt}\nJarvis:`;
        const url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai&seed=42`;

        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const text = await res.text();
                if (text && text.trim()) {
                    return text.trim()
                        .replace(/[\*\#\_]/g, '')
                        .replace(/^jarvis:\s*/i, '');
                }
            }
        } catch(e) {
            clearTimeout(timeoutId);
        }
        return null;
    }

    // --- Gemini 1.5 Flash (If key provided) ---
    async queryGemini(userPrompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
        const systemInstruction = `You are ANRU AI, an ultra-smart, charismatic Indian AI voice assistant created by Boss ${this.bossName}.
Speak in crisp conversational Hinglish. Answer strictly in 1 to 2 sentences maximum. No markdown formatting.`;

        const payload = {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.8, maxOutputTokens: 100 }
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
