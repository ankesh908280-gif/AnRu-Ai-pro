# 🧠 ANRU AI v4.0 - Self-Learning Brain & Single-File G-Drive Vault

यह **ANRU AI** का अपग्रेडेड **Self-Learning Human-Like Edition (100% Flat Single-Folder)** है।  
इसमें **IndexedDB + LocalStorage Dual Mirror** लगा है जो बिना किसी डेटा लॉस के आपके फ़ोन में 2-3GB तक का ज्ञान ऑफ़लाइन स्टोर कर सकता है, और **सिर्फ़ एक सिंगल फ़ाइल (`ANRU_AI_Master_Brain_Backup.json`)** में आपके 4TB Google Drive पर बैकअप होता है।

---

## ⚡ 1. यह कैसे सीखता और याद रखता है (3-Way Self-Learning):

1. **बातचीत से खुद सीखना (Live Voice Training):**
   - **पर्सनल बातें याद कराना:** बोलिए—*"याद रखो मेरे दोस्त रोहित का बर्थडे 10 अगस्त को है"* या *"याद रखो मुझे कोडिंग पसंद है"*।
   - **नया सवाल-जवाब सिखाना:** बोलिए—*"जब कोई पूछे तुम्हारा फेवरेट हीरो कौन है तो बोलना आयरन मैन"*।
   - **गलत जवाब सुधारना:** अगर कभी कोई जवाब पसंद न आए, तो तुरंत बोलिए—*"गलत जवाब, इसका सही जवाब [आपका जवाब] है"*—यह तुरंत अपनी गलती सुधार कर हमेशा के लिए सेव कर लेगा!

2. **इंटरनेट से खुद सीखकर ऑफ़लाइन सेव करना (Auto-Internet Harvester):**
   - जब आप कोई नया सवाल पूछते हैं, तो यह इंटरनेट/AI से जवाब ढूँढकर आपको इंसानी लहजे में बताता है और **साथ ही उसे अपने ऑफ़लाइन दिमाग (IndexedDB) में हमेशा के लिए सेव कर लेता है**। अगली बार वही सवाल पूछने पर बिना इंटरनेट तुरंत जवाब मिलेगा!

3. **🧠 Brain Studio पैनल (Bulk Gemini Data Booster):**
   - ऐप में ऊपर **🧠** बटन दबाकर आप **Brain Studio** खोल सकते हैं।
   - वहाँ आप Gemini से लिए गए हज़ारों सवाल-जवाब (`Sawal | Jawab` या JSON फॉर्मेट में) एक साथ पेस्ट करके **Train Bulk Data** दबा सकते हैं।

---

## 🛡️ 2. Zero Data Loss: 1-File Google Drive Backup

आपका सारा डेटा (सीखे गए सवाल-जवाब, आपकी और दोस्तों की यादें, VIP कॉन्टैक्ट्स और सेटिंग्स) **सिर्फ़ एक ही मास्टर फ़ाइल (`ANRU_AI_Master_Brain_Backup.json`)** में रहता है:
* **बैकअप लेने के लिए:** ऊपर **🧠** बटन दबाएँ ➔ **`📥 Export 1-File Backup (.json)`** पर क्लिक करें (या बोलें *"Brain backup karo"*)। डाउनलोड हुई उस एक फ़ाइल को अपने 4TB Google Drive में रख लें।
* **रीस्टोर / मर्ज करने के लिए:** **`📤 Restore / Merge File`** दबाकर अपनी बैकअप फ़ाइल चुनें। यह आपके पुराने डेटा को डिलीट किए बिना नए डेटा को सुरक्षित रूप से जोड़ (Smart Merge) देता है!

---

## ☁️ 3. 4TB Google Drive ऑटो-सिंक (Optional Free Cloud Script):

अगर आप चाहते हैं कि बिना बटन दबाए भी आपका डेटा अपने आप Google Drive की एक ही फ़ाइल में सेव होता रहे:
1. पीसी या फ़ोन के ब्राउज़र में `script.google.com` खोलें और **New Project** बनाएँ।
2. नीचे दिया गया छोटा सा कोड पेस्ट करें:
```javascript
const FILE_NAME = 'ANRU_AI_Master_Brain_Backup.json';

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const content = JSON.stringify(body.data, null, 2);
  const files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    files.next().setContent(content);
  } else {
    DriveApp.createFile(FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
  return ContentService.createTextOutput(JSON.stringify({ok: true})).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    return ContentService.createTextOutput(files.next().getBlob().getDataAsString()).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('{}').setMimeType(ContentService.MimeType.JSON);
}
```
3. **Deploy ➔ New Deployment ➔ Web App** चुनें (*Who has access: Anyone* रखें) और मिलने वाला URL अपने ANRU AI के **Brain Studio** में पेस्ट कर दें!
