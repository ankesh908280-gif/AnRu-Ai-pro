// memory_db.js - Smart Common-Sense Memory Vault (Perspective-Aware + Zero-Data-Loss Single-File G-Drive Backup)

class AnruMemoryDB {
    constructor() {
        this.dbName = 'AnruBrainVaultDB';
        this.dbVersion = 1;
        this.db = null;
        this.mirrorKey = 'anru_brain_mirror_v1';
        this.gdriveWebhookKey = 'anru_gdrive_webhook_url';
        this.lastSyncKey = 'anru_last_sync_time';

        this.knowledgeCache = [];
        this.factsCache = [];
        this.chatHistory = [];
        this.lastTopic = '';
        this.isReady = false;

        this.stopWords = new Set([
            'kya', 'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'ka', 'ki', 'ke', 'ko', 'me', 'mein',
            'se', 'par', 'pe', 'aur', 'ya', 'to', 'toh', 'bhi', 'hi', 'batao', 'bataiye', 'bata',
            'mujhe', 'mere', 'mera', 'meri', 'apna', 'apni', 'tum', 'aap', 'anru', 'jarvis', 'boss',
            'bhai', 'bro', 'yaar', 'please', 'plz', 'ek', 'is', 'are', 'was', 'were', 'what', 'who',
            'where', 'when', 'why', 'how', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'about', 'karo',
            'karna', 'karke', 'dikhao', 'sunao', 'bol', 'bolo', 'kaun', 'konsa', 'konsi', 'kisko', 'kon'
        ]);

        this.initPromise = this.init();
    }

    async init() {
        try {
            await this.openDatabase();
            await this.loadIntoMemoryCache();
            await this.ensureSeedKnowledge();
            this.isReady = true;
        } catch (err) {
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
            this.restoreFromLocalMirror();
            for (const k of this.knowledgeCache) await this.putInStore('knowledge', k);
            for (const f of this.factsCache) await this.putInStore('facts', f);
        } else {
            this.knowledgeCache = kList;
            this.factsCache = fList.map(f => {
                f.factText = this.convertFirstPersonToSecondPerson(f.factText);
                return f;
            });
            this.chatHistory = cList.sort((a, b) => a.timestamp - b.timestamp).slice(-20);
        }
    }

    saveToLocalMirror() {
        try {
            const mirrorObj = {
                updatedAt: Date.now(),
                facts: this.factsCache.slice(-200),
                learnedKnowledge: this.knowledgeCache.filter(k => k.source !== 'seed').slice(-500),
                chatHistory: this.chatHistory.slice(-15)
            };
            localStorage.setItem(this.mirrorKey, JSON.stringify(mirrorObj));
        } catch (e) {}
    }

    restoreFromLocalMirror() {
        try {
            const raw = localStorage.getItem(this.mirrorKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.facts)) {
                this.factsCache = parsed.facts.map(f => {
                    f.factText = this.convertFirstPersonToSecondPerson(f.factText);
                    return f;
                });
            }
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

    // --- Common-Sense Perspective Transformer ("Main Rukmani se pyar karta hu" -> "Aap Rukmani se pyar karte hain") ---
    convertFirstPersonToSecondPerson(text) {
        if (!text) return '';
        let s = text.trim();

        // Check if sentence is about Boss ("main / me / mera / meri / mere / mujhe")
        const loveMatch = s.match(/^(?:main|me|mein|mai)\s+(.+?)\s+se\s+(?:pyar|pyaar|payr|love|mohabbat)\s+(?:karta|krti|karti|krta)\s*(?:hu|hoon|hun|hai)?$/i);
        if (loveMatch && loveMatch[1]) {
            const person = loveMatch[1].trim();
            return `${person} woh khaas insaan hain jinse aap (Boss) bohot pyar karte hain`;
        }

        const reverseLoveMatch = s.match(/^(.+?)\s+se\s+(?:main|me|mein|mai)\s+(?:pyar|pyaar|payr|love|mohabbat)\s+(?:karta|krti|karti|krta)\s*(?:hu|hoon|hun|hai)?$/i);
        if (reverseLoveMatch && reverseLoveMatch[1]) {
            const person = reverseLoveMatch[1].trim();
            return `${person} woh khaas insaan hain jinse aap (Boss) bohot pyar karte hain`;
        }

        // General 1st person to respectful 2nd person ("aap") conversion
        s = s
            .replace(/\b(main|mein|mai|me)\b/gi, 'aap')
            .replace(/\bmera\b/gi, 'aapka')
            .replace(/\bmeri\b/gi, 'aapki')
            .replace(/\bmere\b/gi, 'aapke')
            .replace(/\bmujhe\b/gi, 'aapko')
            .replace(/\bmujhse\b/gi, 'aapse')
            .replace(/\bkarta\s+(?:hoon|hu|hun)\b/gi, 'karte hain')
            .replace(/\bkrta\s+(?:hoon|hu|hun)\b/gi, 'karte hain')
            .replace(/\bkarti\s+(?:hoon|hu|hun)\b/gi, 'karti hain')
            .replace(/\brehta\s+(?:hoon|hu|hun)\b/gi, 'rehte hain')
            .replace(/\bchahta\s+(?:hoon|hu|hun)\b/gi, 'chahte hain')
            .replace(/\b(?:hoon|hun|hu)\b/gi, 'hain');

        return s;
    }

    async ensureSeedKnowledge() {
        const seeds = [
            {
                q: 'bharat ke pradhan mantri kaun hai',
                a: 'Bharat ke Pradhan Mantri Shri Narendra Modi hain.',
                cat: 'gk'
            },
            {
                q: 'bharat ki rashtrapati kaun hai',
                a: 'Bharat ki Rashtrapati Smt. Droupadi Murmu hain.',
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
                a: 'Generative AI ek aisi adhunik technology hai jo insani dimaag ki tarah naye text, code, images aur aawaz khud soch kar bana sakti hai.',
                cat: 'tech'
            },
            {
                q: 'artificial intelligence ai kya hai',
                a: 'Artificial Intelligence computer vigyan ki wo shakha hai jo machines ko insano ki tarah sochne, samajhne aur common sense lagane ki shakti deti hai.',
                cat: 'tech'
            },
            {
                q: 'black hole kya hota hai',
                a: 'Black hole antariksh me ek aisi jagah hai jahan gravity itni zyada taqatwar hoti hai ki wahan se roshni bhi bahar nahi nikal sakti.',
                cat: 'science'
            },
            {
                q: 'coding kaise seekhe',
                a: 'Coding seekhne ke liye HTML, CSS aur JavaScript ya Python se shuruat karein aur roz chhote-chhote real projects banayein.',
                cat: 'tech'
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

    async learnQA(question, answer, source = 'user_trained', category = 'learned') {
        if (!question || !answer) return null;
        const normQ = this.normalizeText(question);
        if (normQ.length < 2) return null;

        // Apply perspective common-sense fix if user taught a personal statement
        const smartAnswer = this.convertFirstPersonToSecondPerson(answer.trim());

        let existing = this.knowledgeCache.find(k => k.normalizedQ === normQ);
        if (existing) {
            existing.answer = smartAnswer;
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
            answer: smartAnswer,
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

    async saveFact(factText, keyHint = '', speaker = 'Boss') {
        if (!factText || !factText.trim()) return null;
        const smartFact = this.convertFirstPersonToSecondPerson(factText.trim());
        const normFact = this.normalizeText(smartFact);

        let existing = this.factsCache.find(f => this.normalizeText(f.factText) === normFact);
        if (existing) {
            existing.timestamp = Date.now();
            await this.putInStore('facts', existing);
            return existing;
        }

        const newFact = {
            id: 'fact_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            key: keyHint || this.extractKeywords(smartFact).slice(0, 4).join(' '),
            factText: smartFact,
            speaker: speaker,
            timestamp: Date.now()
        };

        this.factsCache.push(newFact);
        await this.putInStore('facts', newFact);
        this.saveToLocalMirror();
        this.triggerAutoCloudSync();
        return newFact;
    }

    async addChatTurn(role, text, topic = '') {
        if (!text) return;
        const turn = {
            id: 'turn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            role: role,
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

    searchFacts(query) {
        if (this.factsCache.length === 0) return null;
        const qKeywords = this.extractKeywords(query);
        if (qKeywords.length === 0) return null;

        let bestFact = null;
        let bestScore = 0;

        for (const fact of this.factsCache) {
            const fNorm = this.normalizeText(fact.factText);
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

    searchKnowledge(query) {
        if (!query || this.knowledgeCache.length === 0) return null;
        const qNorm = this.normalizeText(query);
        if (!qNorm) return null;

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

    async bulkTrainFromTextOrJson(rawInput) {
        if (!rawInput || !rawInput.trim()) return { added: 0, factsAdded: 0 };
        const text = rawInput.trim();
        let added = 0;
        let factsAdded = 0;

        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                const parsed = JSON.parse(text);
                return await this.mergeMasterBackupObject(parsed);
            } catch (e) {}
        }

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
                await this.saveFact(line, '', 'BulkTrainer');
                factsAdded++;
            }
        }

        return { added, factsAdded };
    }

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

    async mergeMasterBackupObject(data) {
        let added = 0;
        let factsAdded = 0;
        if (!data) return { added: 0, factsAdded: 0 };

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

    getGDriveWebhookUrl() {
        return localStorage.getItem(this.gdriveWebhookKey) || '';
    }

    setGDriveWebhookUrl(url) {
        localStorage.setItem(this.gdriveWebhookKey, (url || '').trim());
    }

    async syncToGoogleDriveSingleFile() {
        const webhookUrl = this.getGDriveWebhookUrl();
        if (!webhookUrl) return { ok: false, reason: 'no_url' };

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
