/* ==========================================================================
   config.js - البيانات الثابتة والإعدادات
   ========================================================================== */

// ===== بيانات المدرسة =====
const SCHOOL_INFO = {
    name: "مدرسة الطرة الثانوية للبنين",
    ministry: "وزارة التربية والتعليم",
    directorate: "مديرية التربية والتعليم للواء الرمثا",
    year: "2026 / 2027",
    principal: "د. طارق جيت"
};

// ===== الصفوف والتخصصات =====
const CLASSES = [
    { id: "IT10", name: "تكنولوجيا المعلومات - عاشر",            short: "IT - عاشر",   teacher: "أ. منذر الزعبي",  quality: "أ. يزن الخطيب" },
    { id: "IT11", name: "تكنولوجيا المعلومات - أول ثانوي",       short: "IT - أول ثانوي", teacher: "أ. منذر الزعبي",  quality: "أ. يزن الخطيب" },
    { id: "IT12", name: "تكنولوجيا المعلومات - ثاني ثانوي",      short: "IT - ثاني ثانوي", teacher: "أ. منذر الزعبي",  quality: "أ. يزن الخطيب" },
    { id: "BM10", name: "إدارة الأعمال - عاشر",                  short: "BM - عاشر",   teacher: "أ. يزن الخطيب",   quality: "أ. منذر الزعبي" },
    { id: "BM11", name: "إدارة الأعمال - أول ثانوي",             short: "BM - أول ثانوي", teacher: "أ. يزن الخطيب",   quality: "أ. منذر الزعبي" },
    { id: "BM12", name: "إدارة الأعمال - ثاني ثانوي",            short: "BM - ثاني ثانوي", teacher: "أ. يزن الخطيب",   quality: "أ. منذر الزعبي" }
];

// ===== المستخدمون الافتراضيون =====
const DEFAULT_USERS = {
    "admin": { password: "admin-2026", name: "د. طارق جيت", role: "admin", classId: null },
    "it10":  { password: "it10-2026",  name: "أ. منذر الزعبي", role: "teacher", classId: "IT10" },
    "it11":  { password: "it11-2026",  name: "أ. منذر الزعبي", role: "teacher", classId: "IT11" },
    "it12":  { password: "it12-2026",  name: "أ. منذر الزعبي", role: "teacher", classId: "IT12" },
    "bm10":  { password: "bm10-2026",  name: "أ. يزن الخطيب",  role: "teacher", classId: "BM10" },
    "bm11":  { password: "bm11-2026",  name: "أ. يزن الخطيب",  role: "teacher", classId: "BM11" },
    "bm12":  { password: "bm12-2026",  name: "أ. يزن الخطيب",  role: "teacher", classId: "BM12" }
};

// ===== حدود التنبيهات =====
const WARNING_THRESHOLD = 5;   // تنبيه أصفر
const ORANGE_THRESHOLD = 25;   // إنذار برتقالي
const RED_THRESHOLD = 35;      // إنذار أحمر

// ===== إعدادات JSONBin =====
const CLOUD_CONFIG = {
    API_URL: "https://api.jsonbin.io/v3/b",
    STORAGE_KEY: "btec_settings",
    SESSION_KEY: "btec_session"
};

// ===== أنواع السجلات =====
const STATUS = {
    PRESENT: "present",    // حاضر
    ABSENT: "absent",      // غائب
    EXCUSED: "excused",    // بعذر
    ESCAPE: "escape",      // هروب
    LATE: "late"           // تأخير
};

// ===== عدد الحصص اليومية =====
const PERIODS_COUNT = 7;

// ===== خيارات دقائق التأخير =====
const LATE_MINUTES_OPTIONS = [5, 10, 15, 20, 30, 45];

// ===== إعدادات احتساب التنبيهات =====
const COUNT_IN_ALERTS = {
    ESCAPE: true,    // الهروب يُحسب في التنبيهات
    LATE: false      // التأخير لا يُحسب في التنبيهات
};

// ===== إعدادات احتساب الإنذارات =====
const COUNT_IN_WARNINGS = {
    ESCAPE: true,    // الهروب يُحسب في الإنذار
    LATE: false      // التأخير لا يُحسب في الإنذار
};

// ===== الأسماء العربية للأنواع =====
const STATUS_NAMES = {
    present: "حاضر",
    absent: "غائب",
    excused: "بعذر",
    escape: "هروب",
    late: "تأخير"
};

const STATUS_ICONS = {
    present: "✅",
    absent: "❌",
    excused: "📝",
    escape: "🏃",
    late: "⏰"
};

// ===== أدوات مساعدة عامة =====
function getStatusColor(total) {
    if (total >= RED_THRESHOLD) return "red";
    if (total >= ORANGE_THRESHOLD) return "orange";
    if (total >= WARNING_THRESHOLD) return "yellow";
    return "green";
}

function getStatusText(total) {
    if (total >= RED_THRESHOLD) return "🔴 إنذار أحمر";
    if (total >= ORANGE_THRESHOLD) return "🟠 إنذار برتقالي";
    if (total >= WARNING_THRESHOLD) return "🟡 تنبيه";
    return "🟢 منتظم";
}

function getWarningLevel(days) {
    if (days >= RED_THRESHOLD) return 3;
    if (days >= ORANGE_THRESHOLD) return 2;
    if (days >= WARNING_THRESHOLD) return 1;
    return 0;
}

function todayISO() {
    return new Date().toISOString().split("T")[0];
}

function formatDateAr(iso) {
    if (!iso) return "";
    const days = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
    const d = new Date(iso + "T00:00:00");
    return iso + " (" + days[d.getDay()] + ")";
}

function numberToArabicWords(num) {
    const ones = ["", "يوم واحد", "يومان", "ثلاثة أيام", "أربعة أيام", "خمسة أيام", "ستة أيام", "سبعة أيام", "ثمانية أيام", "تسعة أيام"];
    const tens = ["", "عشرة أيام", "عشرون يومًا", "ثلاثون يومًا", "أربعون يومًا", "خمسون يومًا", "ستون يومًا", "سبعون يومًا", "ثمانون يومًا", "تسعون يومًا"];
    if (num < 10) return ones[num];
    if (num === 10) return "عشرة أيام";
    if (num < 20) return ones[num - 10] + " عشر";
    if (num % 10 === 0) return tens[num / 10];
    return ones[num % 10] + " و" + tens[Math.floor(num / 10)];
}

function getClassById(id) {
    return CLASSES.find(function(c) { return c.id === id; });
}
