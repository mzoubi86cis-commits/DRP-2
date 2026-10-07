/* ==========================================================================
   cloud.js - الاتصال السحابي بـ JSONBin.io
   ========================================================================== */

const Cloud = {
    // الحصول على الإعدادات المحفوظة
    getSettings: function() {
        try {
            return JSON.parse(localStorage.getItem(CLOUD_CONFIG.STORAGE_KEY) || "null");
        } catch(e) { return null; }
    },

    // حفظ الإعدادات
    saveSettings: function(settings) {
        try {
            localStorage.setItem(CLOUD_CONFIG.STORAGE_KEY, JSON.stringify(settings));
            return true;
        } catch(e) { return false; }
    },

    // مسح الإعدادات
    clearSettings: function() {
        try { localStorage.removeItem(CLOUD_CONFIG.STORAGE_KEY); } catch(e) {}
    },

    // تحميل البيانات من السحابة
    load: async function() {
        const s = this.getSettings();
        if (!s || !s.binId || !s.masterKey) throw new Error("الإعدادات غير مكتملة");
        const res = await fetch(CLOUD_CONFIG.API_URL + "/" + s.binId + "/latest", {
            method: "GET",
            headers: { "X-Master-Key": s.masterKey }
        });
        if (!res.ok) throw new Error("فشل التحميل من السحابة (" + res.status + ")");
        const data = await res.json();
        return data.record || null;
    },

    // حفظ البيانات في السحابة
    save: async function(payload) {
        const s = this.getSettings();
        if (!s || !s.binId || !s.masterKey) throw new Error("الإعدادات غير مكتملة");
        const res = await fetch(CLOUD_CONFIG.API_URL + "/" + s.binId, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": s.masterKey
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("فشل الحفظ في السحابة (" + res.status + ")");
        return await res.json();
    },

    // اختبار الاتصال
    test: async function() {
        const s = this.getSettings();
        if (!s || !s.binId || !s.masterKey) return false;
        try {
            await this.load();
            return true;
        } catch(e) {
            return false;
        }
    }
};