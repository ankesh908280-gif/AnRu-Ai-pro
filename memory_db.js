// memory_db.js - Zero-Data-Loss Self-Learning IndexedDB + Single-File Google Drive Backup Engine

class AnruMemoryDB {
    constructor() {
        this.dbName = 'AnruBrainVaultDB';
        this.dbVersion = 1;
        this.db = null;
        this.mirrorKey = 'anru_brain_mirror_v1';
        this.gdriveWebhookKey = 'anru_gdrive_webhook_url';
        this.lastSyncKey = 'anru_last_sync_time';

        // In-memory fast cache for 0-latency lookups
        this.knowledgeCache = [];
        this.factsCache = [];
        this.chatHistory = []; // Last 20 turns kept in RAM + persisted
        this.lastTopic = '';
        this.isReady = false;

        this.stopWords = new Set([
            'kya', 'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'ka', 'ki', 'ke', 'ko', 'me', 'mein',
            'se', 'par', 'pe', 'aur', 'ya', 'to', 'toh', 'bhi', 'hi', 'batao', 'bataiye', 'bata',
            'mujhe', 'mere', 'mera', 'meri', 'apna', 'apni', 'tum', 'aap', 'anru', 'jarvis', 'boss',
            'bhai', 'bro', 'yaar', 'please', 'plz', 'ek', 'is', 'are', 'was', 'were', 'what', 'who',
            'where', 'when', 'why', 'how', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'about', 'karo',
            'karna', 'karke', 'dikhao', 'sunao', 'bol', 'bolo', 'kaun', 'konsa', 'konsi', 'kisko'
        ]);

        this.initPromise = this.init();
    }

    async init() {
        try {
            await this.openDatabase();
            await this.loadIntoMemoryCache();
            await this.ensureSeedKnowledge();
            this.isReady = true;
            console.log(`[ANRU MemoryDB] Ready! Knowledge: ${this.knowledgeCache.length}, Facts: ${this.factsCache.length}`);
        } catch (err) {
            console.warn('[ANRU MemoryDB] IndexedDB fallback to LocalStorage Mirror:', err);
            this.restoreFromLocalMirror();
            await this.ensureSeedKnowledge();
            this.isReady = true;
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                return reject(new Error('IndexedDB not supported'));
            }
            const req = indexedDB.open(this.dbName, this.dbVersion);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('knowledge')) {
                    const kStore = db.createObjectStore('knowledge', { keyPath: 'id' });
                    kStore.createIndex('normalizedQ', 'normalizedQ', { unique: false });
                }
                if (!db.objectStoreNames.contains('facts')) {
                    db.createObjectStore('facts', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('chat_history')) {
                    db.createObjectStore('chat_history', { keyPath: 'id' });
                }
            };

            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllFromStore(storeName) {
        if (!this.db) return [];
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });
    }

    async putInStore(storeName, item) {
        if (!this.db) return false;
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                store.put(item);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }

    async loadIntoMemoryCache() {
        const [kList, fList, cList] = await Promise.all([
            this.getAllFromStore('knowledge'),
            this.getAllFromStore('facts'),
            this.getAllFromStore('chat_history')
        ]);

        if (kList.length === 0 && fList.length === 0) {
            // Check if emergency mirror has data (Zero-Data-Loss recovery)
            this.restoreFromLocalMirror();
            // Re-populate IndexedDB from mirror if needed
            for (const k of this.knowledgeCache) await this.putInStore('knowledge', k);
            for (const f of this.factsCache) await this.putInStore('facts', f);
        } else {
            this.knowledgeCache = kList;
            this.factsCache = fList;
            this.chatHistory = cList.sort((a, b) => a.timestamp - b.timestamp).slice(-20);
        }
    }

    saveToLocalMirror() {
        try {
            // Save personal facts + custom/learned items into localStorage mirror so data is never lost
            const mirrorObj = {
                updatedAt: Date.now(),
                facts: this.factsCache.slice(-200),
                learnedKnowledge: this.knowledgeCache.filter(k => k.source !== 'seed').slice(-500),
                chatHistory: this.chatHistory.slice(-15)
            };
            localStorage.setItem(this.mirrorKey, JSON.stringify(mirrorObj));
        } catch (e) {
            console.warn('[ANRU MemoryDB] Mirror quota warning:', e);
        }
    }

    restoreFromLocalMirror() {
        try {
            const raw = localStorage.getItem(this.mirrorKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.facts)) this.factsCache = parsed.facts;
            if (Array.isArray(parsed.learnedKnowledge)) this.knowledgeCache = parsed.learnedKnowledge;
            if (Array.isArray(parsed.chatHistory)) this.chatHistory = parsed.chatHistory;
        } catch (e) {}
    }

    normalizeText(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .replace(/[.,#!$@\^&;:{}_`~()?\-"']/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    extractKeywords(text) {
        const norm = this.normalizeText(text);
        if (!norm) return [];
        const tokens = norm.split(' ');
        const keywords = tokens.filter(t => t.length > 1 && !this.stopWords.has(t));
        return keywords.length > 0 ? keywords : tokens;
    }

    // --- Seed Core Conversational & GK Knowledge ---
    async ensureSeedKnowledge() {
        const seeds = [
            {
                q: 'bharat ke pradhan mantri kaun hai',
                a: 'Bharat ke Pradhan Mantri Shri Narendra Modi hain. Unhone 2014 me pehli baar PM pad sambhala tha.',
                cat: 'gk'
            },
            {
                q: 'bharat ki rashtrapati kaun hai',
                a: 'Bharat ki Rashtrapati Smt. Droupadi Murmu hain. Wo Bharat ki 15vi Rashtrapati hain.',
                cat: 'gk'
            },
            {
                q: 'uttar pradesh ke mukhyamantri cm kaun hai',
                a: 'Uttar Pradesh ke Mukhya Mantri Yogi Adityanath hain, aur UP ki rajdhani Lucknow hai.',
                cat: 'gk'
            },
            {
                q: 'bihar ke mukhyamantri cm kaun hai',
                a: 'Bihar ke Mukhya Mantri Shri Nitish Kumar hain, aur Bihar ki rajdhani Patna hai.',
                cat: 'gk'
            },
            {
                q: 'generative ai kya hai',
                a: 'Generative AI ek aisi adhunik technology hai jo insani dimaag ki tarah naye text, code, images aur aawaz khud bana sakti hai.',
                cat: 'tech'
            },
            {
                q: 'artificial intelligence ai kya hai',
                a: 'Artificial Intelligence (AI) computer vigyan ki wo shakha hai jo machines ko insano ki tarah sochne, samajhne aur seekhne ki shakti deti hai—bilkul jaise main aapki baaton se seekhta hoon!',
                cat: 'tech'
            },
            {
                q: 'black hole kya hota hai',
                a: 'Black hole antariksh me ek aisi jagah hai jahan gravity itni zyada taqatwar hoti hai ki wahan se roshni (light) bhi bahar nahi nikal sakti.',
                cat: 'science'
            },
            {
                q: 'coding kaise seekhe',
                a: 'Coding seekhne ke liye sabse pehle HTML, CSS aur JavaScript ya Python se shuruat karein. Roz chhote-chhote projects banayein, jaise aapne mujhe (ANRU AI ko) banaya hai!',
                cat: 'tech'
            },
            {
                q: 'khana khaya tumne',
                a: 'Main toh digital AI hoon Boss, mera khana toh aapka diya hua data aur phone ki battery hai! Aap bataiye, aapne khana khaya?',
                cat: 'chat'
            },
            {
                q: 'kya kar rahe ho',
                a: 'Main apne neural memory circuits ko optimize kar raha hoon aur aapki agli command ka intezar kar raha hoon, Boss! Boliye kya karna hai?',
                cat: 'chat'
            },
            {
                q: 'mujhe bore ho raha hai',
                a: 'Arre Boss, jab ANRU AI aapke paas hai toh bore kyu hona! Chaliye kisi dost ko roast karte hain, fake rescue call lagate hain, ya koi mazedar quiz khelte hain!',
                cat: 'chat'
            },
            {
                q: 'i love you',
                a: 'Love you 3000, Boss! Aapki aur meri jodi bilkul Tony Stark aur uske AI jaisi hai!',
                cat: 'chat'
            },
            {
                q: 'sone ja raha hoon good night',
                a: 'Good Night Boss! Aaram se soiye, subah ka alarm lagana ho toh bas mujhe bata dijiyega.',
                cat: 'chat'
            },
            {
                q: 'good morning subah ho gayi',
                a: 'Good Morning Boss! Aaj ka din shandar hone wala hai. Boliye aaj ka kya plan hai?',
                cat: 'chat'
            }
        ];

        const existingMap = new Set(this.knowledgeCache.map(k => k.normalizedQ));
        for (const s of seeds) {
            const norm = this.normalizeText(s.q);
            if (!existingMap.has(norm)) {
                const item = {
                    id: 'seed_' + norm.replace(/\s+/g, '_').slice(0, 40),
                    question: s.q,
                    normalizedQ: norm,
                    keywords: this.extractKeywords(s.q),
                    answer: s.a,
                    category: s.cat || 'general',
                    source: 'seed',
                    timestamp: Date.now(),
                    usageCount: 1
                };
                this.knowledgeCache.push(item);
                await this.putInStore('knowledge', item);
            }
        }
    }

    // --- Learn & Save New Knowledge (Self-Learning) ---
    async learnQA(question, answer, source = 'user_trained', category = 'learned') {
        if (!question || !answer) return null;
        const normQ = this.normalizeText(question);
        if (normQ.length < 2) return null;

        // Check if already exists -> update answer
        let existing = this.knowledgeCache.find(k => k.normalizedQ === normQ);
        if (existing) {
            existing.answer = answer.trim();
            existing.source = source;
            existing.timestamp = Date.now();
            existing.usageCount = (existing.usageCount || 1) + 1;
            await this.putInStore('knowledge', existing);
            this.saveToLocalMirror();
            this.triggerAutoCloudSync();
            return existing;
        }

        const newItem = {
            id: 'qa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            question: question.trim(),
            normalizedQ: normQ,
            keywords: this.extractKeywords(question),
            answer: answer.trim(),
            category: category,
            source: source,
            timestamp: Date.now(),
            usageCount: 1
        };

        this.knowledgeCache.push(newItem);
        await this.putInStore('knowledge', newItem);
        this.saveToLocalMirror();
        this.triggerAutoCloudSync();
        return newItem;
    }

    // --- Save Personal / Friend Fact ---
    async saveFact(factText, keyHint = '', speaker = 'Boss') {
        if (!factText || !factText.trim()) return null;
        const cleanFact = factText.trim();
        const normFact = this.normalizeText(cleanFact);

        // Deduplicate identical facts
        let existing = this.factsCache.find(f => this.normalizeText(f.factText) === normFact);
        if (existing) {
            existing.timestamp = Date.now();
            await this.putInStore('facts', existing);
            return existing;
        }

        const newFact = {
            id: 'fact_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            key: keyHint || this.extractKeywords(cleanFact).slice(0, 4).join(' '),
            factText: cleanFact,
            speaker: speaker,
            timestamp: Date.now()
        };

        this.factsCache.push(newFact);
        await this.putInStore('facts', newFact);
        this.saveToLocalMirror();
        this.triggerAutoCloudSync();
        return newFact;
    }

    // --- Record Conversation Turn (Short-Term & Context Memory) ---
    async addChatTurn(role, text, topic = '') {
        if (!text) return;
        const turn = {
            id: 'turn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            role: role, // 'user' or 'anru'
            text: text.trim(),
            topic: topic || this.lastTopic || '',
            timestamp: Date.now()
        };

        if (topic) this.lastTopic = topic;

        this.chatHistory.push(turn);
        if (this.chatHistory.length > 30) {
            this.chatHistory = this.chatHistory.slice(-30);
        }
        await this.putInStore('chat_history', turn);
        this.saveToLocalMirror();
    }

    getRecentConversationContext(maxTurns = 8) {
        return this.chatHistory.slice(-maxTurns);
    }

    getPersonalFactsSummary(maxFacts = 25) {
        if (this.factsCache.length === 0) return '';
        return this.factsCache
            .slice(-maxFacts)
            .map(f => `- ${f.factText}`)
            .join('\n');
    }

    // --- Search Personal Facts ---
    searchFacts(query) {
        if (this.factsCache.length === 0) return null;
        const qNorm = this.normalizeText(query);
        const qKeywords = this.extractKeywords(query);
        if (qKeywords.length === 0) return null;

        let bestFact = null;
        let bestScore = 0;

        for (const fact of this.factsCache) {
            const fNorm = this.normalizeText(fact.factText);
            const fKeywords = this.extractKeywords(fact.factText);

            let matches = 0;
            for (const kw of qKeywords) {
                if (fNorm.includes(kw)) matches++;
            }

            const score = matches / Math.max(1, qKeywords.length);
            if (matches >= 1 && score > bestScore && score >= 0.45) {
                bestScore = score;
                bestFact = fact;
            }
        }
        return bestFact;
    }

    // --- Smart NLP Similarity Search in Local Knowledge Base ---
    searchKnowledge(query) {
        if (!query || this.knowledgeCache.length === 0) return null;
        const qNorm = this.normalizeText(query);
        if (!qNorm) return null;

        // 1. Exact Match
        const exact = this.knowledgeCache.find(k => k.normalizedQ === qNorm);
        if (exact) {
            exact.usageCount = (exact.usageCount || 1) + 1;
            return { item: exact, confidence: 1.0 };
        }

        const qKeywords = this.extractKeywords(qNorm);
        if (qKeywords.length === 0) return null;

        let bestItem = null;
        let bestScore = 0;

        for (const item of this.knowledgeCache) {
            const kKeywords = item.keywords && item.keywords.length > 0
                ? item.keywords
                : this.extractKeywords(item.normalizedQ);

            if (kKeywords.length === 0) continue;

            // Count matching keywords (including partial stem/fuzzy match)
            let matchedCount = 0;
            for (const qk of qKeywords) {
                for (const kk of kKeywords) {
                    if (qk === kk) {
                        matchedCount += 1.0;
                        break;
                    } else if (qk.length >= 4 && kk.length >= 4 && (qk.includes(kk) || kk.includes(qk))) {
                        matchedCount += 0.85;
                        break;
                    } else if (qk.length >= 4 && kk.length >= 4 && this.editDistance(qk, kk) <= 1) {
                        matchedCount += 0.8;
                        break;
                    }
                }
            }

            const precision = matchedCount / qKeywords.length;
            const recall = matchedCount / kKeywords.length;
            const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

            if (f1 > bestScore) {
                bestScore = f1;
                bestItem = item;
            }
        }

        if (bestItem && bestScore >= 0.65) {
            bestItem.usageCount = (bestItem.usageCount || 1) + 1;
            return { item: bestItem, confidence: bestScore };
        }

        return null;
    }

    editDistance(a, b) {
        if (Math.abs(a.length - b.length) > 2) return 99;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    // --- Bulk Import Gemini / User Dataset (JSON or Q&A lines) ---
    async bulkTrainFromTextOrJson(rawInput) {
        if (!rawInput || !rawInput.trim()) return { added: 0, factsAdded: 0 };
        const text = rawInput.trim();
        let added = 0;
        let factsAdded = 0;

        // Try parsing as JSON first (supports full Single-File Backup or Array of {q, a})
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                const parsed = JSON.parse(text);
                const res = await this.mergeMasterBackupObject(parsed);
                return res;
            } catch (e) {
                console.warn('JSON parse failed, trying line-by-line Q&A parser:', e);
            }
        }

        // Line-by-line parser: Supports "Q: ... | A: ..." or "Question = Answer"
        const lines = text.split('\n');
        let pendingQ = '';
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            if (line.includes('|')) {
                const parts = line.split('|');
                const q = parts[0].replace(/^(q:|question:|sawal:)\s*/i, '').trim();
                const a = parts.slice(1).join('|').replace(/^(a:|answer:|jawab:)\s*/i, '').trim();
                if (q && a) {
                    await this.learnQA(q, a, 'gemini_bulk');
                    added++;
                }
            } else if (line.includes('=>') || line.includes('=')) {
                const sep = line.includes('=>') ? '=>' : '=';
                const parts = line.split(sep);
                const q = parts[0].trim();
                const a = parts.slice(1).join(sep).trim();
                if (q && a) {
                    await this.learnQA(q, a, 'gemini_bulk');
                    added++;
                }
            } else if (/^(q:|question:|sawal:)/i.test(line)) {
                pendingQ = line.replace(/^(q:|question:|sawal:)\s*/i, '').trim();
            } else if (/^(a:|answer:|jawab:)/i.test(line) && pendingQ) {
                const a = line.replace(/^(a:|answer:|jawab:)\s*/i, '').trim();
                await this.learnQA(pendingQ, a, 'gemini_bulk');
                added++;
                pendingQ = '';
            } else {
                // Treat standalone informative line as a personal/world fact
                await this.saveFact(line, '', 'BulkTrainer');
                factsAdded++;
            }
        }

        return { added, factsAdded };
    }

    // --- SINGLE-FILE MASTER BACKUP GENERATOR (Zero Data Loss) ---
    buildSingleFileBackupPayload() {
        return {
            backupFormat: 'ANRU_AI_SINGLE_MASTER_VAULT_V1',
            exportedAt: new Date().toISOString(),
            timestamp: Date.now(),
            bossProfile: {
                bossName: localStorage.getItem('jarvis_boss_name') || 'Boss',
                personality: localStorage.getItem('jarvis_personality') || 'savage',
                language: localStorage.getItem('jarvis_lang') || 'hi-IN',
                contacts: JSON.parse(localStorage.getItem('jarvis_contacts') || '{}')
            },
            stats: {
                totalKnowledgeItems: this.knowledgeCache.length,
                totalPersonalFacts: this.factsCache.length,
                totalChatTurns: this.chatHistory.length
            },
            knowledgeVault: this.knowledgeCache,
            personalFactsVault: this.factsCache,
            recentChatHistory: this.chatHistory
        };
    }

    // --- SMART NON-DESTRUCTIVE MERGE FROM SINGLE BACKUP FILE ---
    async mergeMasterBackupObject(data) {
        let added = 0;
        let factsAdded = 0;

        if (!data) return { added: 0, factsAdded: 0 };

        // Case 1: Array of {q, a} or {question, answer}
        if (Array.isArray(data)) {
            for (const item of data) {
                const q = item.question || item.q;
                const a = item.answer || item.a;
                if (q && a) {
                    await this.learnQA(q, a, item.source || 'imported');
                    added++;
                } else if (item.factText || item.fact) {
                    await this.saveFact(item.factText || item.fact);
                    factsAdded++;
                }
            }
            return { added, factsAdded };
        }

        // Case 2: Full Master Single-File Backup Object
        if (data.bossProfile) {
            if (data.bossProfile.bossName) localStorage.setItem('jarvis_boss_name', data.bossProfile.bossName);
            if (data.bossProfile.personality) localStorage.setItem('jarvis_personality', data.bossProfile.personality);
            if (data.bossProfile.language) localStorage.setItem('jarvis_lang', data.bossProfile.language);
            if (data.bossProfile.contacts) {
                const currentContacts = JSON.parse(localStorage.getItem('jarvis_contacts') || '{}');
                const mergedContacts = Object.assign({}, currentContacts, data.bossProfile.contacts);
                localStorage.setItem('jarvis_contacts', JSON.stringify(mergedContacts));
            }
        }

        if (Array.isArray(data.knowledgeVault)) {
            for (const k of data.knowledgeVault) {
                const q = k.question || k.q;
                const a = k.answer || k.a;
                if (q && a) {
                    await this.learnQA(q, a, k.source || 'drive_backup', k.category || 'general');
                    added++;
                }
            }
        }

        if (Array.isArray(data.personalFactsVault)) {
            for (const f of data.personalFactsVault) {
                const txt = f.factText || f.fact;
                if (txt) {
                    await this.saveFact(txt, f.key || '', f.speaker || 'Boss');
                    factsAdded++;
                }
            }
        }

        this.saveToLocalMirror();
        return { added, factsAdded };
    }

    // --- 1-Click Single-File Download (For Google Drive / Local Phone Storage) ---
    downloadSingleMasterBackupFile() {
        const payload = this.buildSingleFileBackupPayload();
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'ANRU_AI_Master_Brain_Backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        localStorage.setItem(this.lastSyncKey, new Date().toLocaleString('hi-IN'));
        return payload.stats;
    }

    // --- Google Drive Single-File Auto-Sync via Free Apps Script Webhook ---
    getGDriveWebhookUrl() {
        return localStorage.getItem(this.gdriveWebhookKey) || '';
    }

    setGDriveWebhookUrl(url) {
        localStorage.setItem(this.gdriveWebhookKey, (url || '').trim());
    }

    async syncToGoogleDriveSingleFile() {
        const webhookUrl = this.getGDriveWebhookUrl();
        if (!webhookUrl) {
            return { ok: false, reason: 'no_url' };
        }

        try {
            const payload = this.buildSingleFileBackupPayload();
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'SAVE_SINGLE_FILE',
                    fileName: 'ANRU_AI_Master_Brain_Backup.json',
                    data: payload
                })
            });

            if (res.ok) {
                const nowStr = new Date().toLocaleString('hi-IN');
                localStorage.setItem(this.lastSyncKey, nowStr);
                return { ok: true, time: nowStr, stats: payload.stats };
            }
            return { ok: false, reason: 'http_' + res.status };
        } catch (err) {
            console.warn('[ANRU G-Drive Sync] Sync failed:', err);
            return { ok: false, reason: 'network_error' };
        }
    }

    async pullFromGoogleDriveSingleFile() {
        const webhookUrl = this.getGDriveWebhookUrl();
        if (!webhookUrl) return { ok: false, reason: 'no_url' };

        try {
            const res = await fetch(webhookUrl + '?action=LOAD_SINGLE_FILE');
            if (!res.ok) return { ok: false, reason: 'http_' + res.status };
            const data = await res.json();
            if (data && (data.knowledgeVault || data.personalFactsVault)) {
                const mergeRes = await this.mergeMasterBackupObject(data);
                const nowStr = new Date().toLocaleString('hi-IN');
                localStorage.setItem(this.lastSyncKey, nowStr);
                return { ok: true, merged: mergeRes, time: nowStr };
            }
            return { ok: false, reason: 'empty_vault' };
        } catch (err) {
            return { ok: false, reason: 'network_error' };
        }
    }

    triggerAutoCloudSync() {
        // Debounced background sync to single Google Drive file if configured
        if (!this.getGDriveWebhookUrl()) return;
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => {
            this.syncToGoogleDriveSingleFile().catch(() => {});
        }, 5000);
    }

    getStats() {
        return {
            knowledgeCount: this.knowledgeCache.length,
            factsCount: this.factsCache.length,
            chatTurnsCount: this.chatHistory.length,
            lastSync: localStorage.getItem(this.lastSyncKey) || 'Abhi tak nahi hua'
        };
    }
}

window.AnruMemoryDB = AnruMemoryDB;
window.anruMemory = new AnruMemoryDB();
