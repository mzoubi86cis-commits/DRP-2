/* ==========================================================================
   app.js - النسخة النهائية (شاملة كل التعديلات)
   ========================================================================== */

// ===== حالة التطبيق =====
const State = {
    students: [], records: [], users: {}, currentUser: null,
    currentClassId: null, dailyDate: todayISO(), dailySelections: {},
    reportsCache: null, autoSaveTimer: null
};

// ===== الحفظ التلقائي =====
function autoSave(delay) {
    delay = delay || 800;
    if (State.autoSaveTimer) clearTimeout(State.autoSaveTimer);
    updateSyncStatus("syncing", "⏳ حفظ تلقائي...");
    State.autoSaveTimer = setTimeout(async function() {
        try {
            await Cloud.save({ students: State.students, records: State.records, users: State.users, lastUpdate: new Date().toISOString() });
            updateSyncStatus("synced", "✅ تم الحفظ");
        } catch (err) { updateSyncStatus("error", "❌ فشل الحفظ"); }
    }, delay);
}

function updateSyncStatus(status, text) {
    const el = document.getElementById("syncStatus");
    if (!el) return;
    el.className = "sync-badge " + status;
    el.textContent = text;
}

// ===== السحابة =====
async function syncFromCloud() {
    if (!confirm("سيتم استبدال البيانات المحلية بالبيانات السحابية. متابعة؟")) return;
    updateSyncStatus("syncing", "⏳ جارٍ التحميل...");
    try {
        const data = await Cloud.load();
        if (data) {
            State.students = data.students || [];
            State.records = data.records || [];
            State.users = data.users || DEFAULT_USERS;
            if (!data.users) await syncToCloud();
        }
        renderAll(); updateSyncStatus("synced", "✅ متزامن"); alert("✅ تمت المزامنة");
    } catch (err) { alert("⚠️ فشل التحميل: " + err.message); }
}

async function syncToCloud() {
    updateSyncStatus("syncing", "⏳ جارٍ الحفظ...");
    try {
        await Cloud.save({ students: State.students, records: State.records, users: State.users, lastUpdate: new Date().toISOString() });
        updateSyncStatus("synced", "✅ متزامن"); return true;
    } catch (err) { alert("⚠️ فشل الحفظ: " + err.message); return false; }
}

async function loadData() {
    try {
        updateSyncStatus("syncing", "⏳ جارٍ التحميل...");
        const data = await Cloud.load();
        if (data) {
            State.students = data.students || [];
            State.records = data.records || [];
            State.users = data.users || DEFAULT_USERS;
        } else {
            State.students = []; State.records = []; State.users = DEFAULT_USERS;
            await syncToCloud();
        }
        updateSyncStatus("synced", "✅ متزامن");
    } catch (e) { updateSyncStatus("error", "⚠️ وضع محلي"); }
}

// ===== التنقل =====
function navigate(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");
    document.querySelectorAll(".nav-btn").forEach(b => { if (b.dataset.page) b.classList.toggle("active", b.dataset.page === page); });
    if (page === "home") { renderStats(); renderStudentsTable(); }
    if (page === "daily") { renderDailyTable(); }
    if (page === "reports") { renderReports(); }
    if (page === "alerts") { renderAlerts(); }
    if (page === "students-admin") { renderAdminStudents(); }
    if (page === "users-admin") { renderAdminUsers(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===== محدد الصف =====
function renderClassSelector() {
    const container = document.getElementById("classSelector");
    if (!container) return;
    const isAdmin = State.currentUser && State.currentUser.role === "admin";
    const userClassId = State.currentUser ? State.currentUser.classId : null;
    container.innerHTML = CLASSES.map(c => {
        const canAccess = isAdmin || (userClassId === c.id);
        const isActive = State.currentClassId === c.id;
        return '<button class="class-tab ' + (isActive ? 'active' : '') + ' ' + (canAccess ? '' : 'locked') + '" ' +
            (canAccess ? 'onclick="selectClass(\'' + c.id + '\')"' : 'disabled') + '>' + c.short + '</button>';
    }).join("");
}

function selectClass(classId) {
    State.currentClassId = classId;
    renderClassSelector(); renderStats(); renderStudentsTable(); renderDailyTable();
}

// ===== الإحصائيات =====
function renderStats() {
    if (!State.currentClassId) return;
    const students = Students.getByClass(State, State.currentClassId);
    const counts = { green: 0, yellow: 0, orange: 0, red: 0 };
    let tA = 0, tE = 0, tEsc = 0, tLate = 0;
    students.forEach(s => {
        const c = Attendance.countForAlerts(State, s.id);
        counts[getStatusColor(c)]++;
        tA += Attendance.countAbsent(State, s.id);
        tE += Attendance.countExcused(State, s.id);
        tEsc += Attendance.countEscapeHours(State, s.id);
        tLate += Attendance.countLateHours(State, s.id);
    });
    document.getElementById("statsCards").innerHTML =
        '<div class="card total"><h3>👥 الطلاب</h3><span class="num">' + students.length + '</span></div>' +
        '<div class="card red"><h3>❌ غياب</h3><span class="num">' + tA + '</span></div>' +
        '<div class="card excused"><h3>📝 بعذر</h3><span class="num">' + tE + '</span></div>' +
        '<div class="card escape"><h3>🏃 هروب</h3><span class="num">' + tEsc + '</span></div>' +
        '<div class="card late"><h3>⏰ تأخير</h3><span class="num">' + tLate + '</span></div>' +
        '<div class="card green"><h3>🟢 منتظم</h3><span class="num">' + counts.green + '</span></div>' +
        '<div class="card yellow"><h3>🟡 تنبيه</h3><span class="num">' + counts.yellow + '</span></div>' +
        '<div class="card orange"><h3>🟠 برتقالي</h3><span class="num">' + counts.orange + '</span></div>' +
        '<div class="card red"><h3>🔴 أحمر</h3><span class="num">' + counts.red + '</span></div>';
}

// ===== جدول الطلاب =====
function renderStudentsTable() {
    const tbody = document.getElementById("studentsTable");
    if (!tbody || !State.currentClassId) return;
    tbody.innerHTML = "";
    const students = Students.getByClass(State, State.currentClassId);
    students.forEach(s => {
        const absent = Attendance.countAbsent(State, s.id);
        const excused = Attendance.countExcused(State, s.id);
        const escapeHours = Attendance.countEscapeHours(State, s.id);
        const lateHours = Attendance.countLateHours(State, s.id);
        const alertTotal = Attendance.countForAlerts(State, s.id);
        const color = getStatusColor(alertTotal);
        const status = getStatusText(alertTotal);
        const level = getWarningLevel(alertTotal);

        const tr = document.createElement("tr");
        tr.className = "row-" + color;
        tr.innerHTML =
            '<td>' + s.id + '</td><td><a class="student-link" onclick="openStudent(' + s.id + ')">' + s.nameAr + '</a></td>' +
            '<td>' + s.number + '</td><td><span class="badge badge-red">' + absent + '</span></td>' +
            '<td><span class="badge badge-excused">' + excused + '</span></td>' +
            '<td><span class="badge badge-escape">' + escapeHours + '</span></td>' +
            '<td><span class="badge badge-late">' + lateHours + '</span></td>' +
            '<td>' + status + '</td><td><button class="btn btn-small btn-info" onclick="openStudent(' + s.id + ')">📋</button>' +
            (level > 0 ? ' <button class="btn btn-small btn-warning" onclick="showWarning(' + s.id + ')">📨</button>' : '') + '</td>';
        tbody.appendChild(tr);
    });
}

// ===== التسجيل اليومي =====
function renderDailyTable() {
    const tbody = document.getElementById("dailyTable");
    if (!tbody || !State.currentClassId) return;
    tbody.innerHTML = "";
    State.dailySelections = {};
    
    const students = Students.getByClass(State, State.currentClassId);
    const classStudentIds = students.map(s => s.id);
    const existing = {};
    
    State.records.filter(r => r.date === State.dailyDate && classStudentIds.includes(r.student_id)).forEach(r => {
        existing[r.student_id] = { status: r.status, escapes: r.escapes || [], lates: r.lates || [] };
    });

    students.forEach(s => {
        const rec = existing[s.id] || { status: "present", escapes: [], lates: [] };
        State.dailySelections[s.id] = { status: rec.status, escapes: rec.escapes, lates: rec.lates };

        let escapeLabel = rec.escapes.length > 0 ? "🏃 هروب (" + rec.escapes.map(e=>"ح"+e.period).join("،") + ")" : "🏃 هروب";
        let lateLabel = rec.lates.length > 0 ? "⏰ تأخير (" + rec.lates.map(l=>"ح"+l.period+"/"+l.minutes+"د").join("،") + ")" : "⏰ تأخير";

        // وضع زر الواتساب في عمود منفصل لتجنب التداخل
        let whatsappBtn = '';
        if (rec.status === "absent") {
            whatsappBtn = '<button class="btn btn-small" style="background:#25D366; color:white; margin:0; padding:5px 10px; font-size:0.9em; border:none; border-radius:4px; cursor:pointer;" onclick="sendAbsentWhatsApp(' + s.id + ')" title="إرسال رسالة غياب لولي الأمر">📱</button>';
        }

        const tr = document.createElement("tr");
        tr.innerHTML =
            '<td>' + s.id + '</td>' +
            '<td>' + s.nameAr + '</td>' +
            '<td>' + s.number + '</td>' +
            '<td style="text-align:center;">' + whatsappBtn + '</td>' +  /* العمود الجديد */
            '<td><div class="status-group" data-sid="' + s.id + '">' +
                '<button class="status-btn ' + (rec.status === "present" ? "active-present" : "") + '" onclick="setDailyStatus(' + s.id + ', \'present\')">✅ حاضر</button>' +
                '<button class="status-btn ' + (rec.status === "absent" ? "active-absent" : "") + '" onclick="setDailyStatus(' + s.id + ', \'absent\')">❌ غائب</button>' +
                '<button class="status-btn ' + (rec.status === "excused" ? "active-excused" : "") + '" onclick="setDailyStatus(' + s.id + ', \'excused\')">📝 بعذر</button>' +
                '<button class="status-btn ' + (rec.escapes.length > 0 ? "active-escape" : "") + '" onclick="openPeriodModal(' + s.id + ', \'escape\')">' + escapeLabel + '</button>' +
                '<button class="status-btn ' + (rec.lates.length > 0 ? "active-late" : "") + '" onclick="openPeriodModal(' + s.id + ', \'late\')">' + lateLabel + '</button>' +
            '</div></td>';
        tbody.appendChild(tr);
    });
    updateDailyCounters();
}

function setDailyStatus(sid, status) {
    if (!State.dailySelections[sid]) {
        State.dailySelections[sid] = { status: status, escapes: [], lates: [] };
    } else {
        State.dailySelections[sid].status = status;
    }
    
    // إعادة رسم الجدول بالكامل لضمان عدم تكرار زر الواتساب
    renderDailyTable();
}

function refreshRowButtons(sid) {
    const group = document.querySelector('.status-group[data-sid="' + sid + '"]');
    if (!group) return;
    const data = State.dailySelections[sid];
    const buttons = group.querySelectorAll(".status-btn");
    buttons.forEach(b => b.className = "status-btn");

    if (data.status === "present") buttons[0].classList.add("active-present");
    if (data.status === "absent") buttons[1].classList.add("active-absent");
    if (data.status === "excused") buttons[2].classList.add("active-excused");

    if (data.escapes.length > 0) {
        buttons[3].classList.add("active-escape");
        buttons[3].textContent = "🏃 هروب (" + data.escapes.map(e=>"ح"+e.period).join("،") + ")";
    } else buttons[3].textContent = "🏃 هروب";

    if (data.lates.length > 0) {
        buttons[4].classList.add("active-late");
        buttons[4].textContent = "⏰ تأخير (" + data.lates.map(l=>"ح"+l.period+"/"+l.minutes+"د").join("،") + ")";
    } else buttons[4].textContent = "⏰ تأخير";
}

function updateDailyCounters() {
    let p = 0, a = 0, e = 0, esc = 0, late = 0;
    Object.values(State.dailySelections).forEach(d => {
        if (d.status === "present") p++;
        else if (d.status === "absent") a++;
        else if (d.status === "excused") e++;
        esc += d.escapes ? d.escapes.length : 0;
        late += d.lates ? d.lates.length : 0;
    });
    document.getElementById("cPresent").textContent = p;
    document.getElementById("cAbsent").textContent = a;
    document.getElementById("cExcused").textContent = e;
    document.getElementById("cEscape").textContent = esc;
    document.getElementById("cLate").textContent = late;
}

function markAll(status) {
    const students = Students.getByClass(State, State.currentClassId);
    students.forEach(s => {
        if (!State.dailySelections[s.id]) State.dailySelections[s.id] = { status: status, escapes: [], lates: [] };
        else State.dailySelections[s.id].status = status;
    });
    students.forEach(s => refreshRowButtons(s.id));
    updateDailyCounters();
}

function resetAll() {
    const students = Students.getByClass(State, State.currentClassId);
    students.forEach(s => { State.dailySelections[s.id] = { status: "present", escapes: [], lates: [] }; });
    students.forEach(s => refreshRowButtons(s.id));
    updateDailyCounters();
}

function setDateToday() { State.dailyDate = todayISO(); document.getElementById("dailyDate").value = State.dailyDate; renderDailyTable(); }
function changeDay(delta) {
    const d = new Date(State.dailyDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    State.dailyDate = d.toISOString().split("T")[0];
    document.getElementById("dailyDate").value = State.dailyDate;
    renderDailyTable();
}

async function saveDailyRecord() {
    if (!State.currentClassId) return alert("اختر صفاً أولاً");
    const students = Students.getByClass(State, State.currentClassId);
    students.forEach(s => {
        if (!State.dailySelections[s.id]) State.dailySelections[s.id] = { status: "present", escapes: [], lates: [] };
    });
    Attendance.saveDay(State, State.currentClassId, State.dailyDate, State.dailySelections);
    const ok = await syncToCloud();
    if (ok) { renderAll(); alert("✅ تم حفظ " + students.length + " سجل بنجاح"); }
}

// ===== نافذة الحصص =====
let periodModalState = { studentId: null, mode: null, periods: [] };

function openPeriodModal(sid, mode) {
    const s = State.students.find(x => x.id === sid);
    if (!s) return;
    const current = State.dailySelections[sid];
    periodModalState = { studentId: sid, mode: mode, periods: [] };

    if (mode === "escape") periodModalState.periods = (current.escapes || []).map(e => ({ period: e.period, minutes: null }));
    else periodModalState.periods = (current.lates || []).map(l => ({ period: l.period, minutes: l.minutes }));

    const modal = document.getElementById("periodModal");
    const title = document.getElementById("periodModalTitle");
    const minutesSection = document.getElementById("minutesSection");

    if (mode === "escape") { title.textContent = "🏃 تسجيل هروب"; minutesSection.style.display = "none"; modal.classList.add("escape-mode"); modal.classList.remove("late-mode"); }
    else { title.textContent = "⏰ تسجيل تأخير"; minutesSection.style.display = "block"; modal.classList.add("late-mode"); modal.classList.remove("escape-mode"); }

    document.getElementById("periodModalStudent").textContent = "الطالب: " + s.nameAr;
    document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("selected"));
    document.querySelectorAll(".minutes-btn").forEach(b => b.classList.remove("selected"));

    periodModalState.periods.forEach(p => {
        document.querySelectorAll(".period-btn").forEach(b => {
            if (parseInt(b.textContent) === p.period) b.classList.add("selected");
        });
    });
    modal.classList.add("show");
}

function selectPeriod(p) {
    const idx = periodModalState.periods.findIndex(x => x.period === p);
    if (idx === -1) periodModalState.periods.push({ period: p, minutes: null });
    else periodModalState.periods.splice(idx, 1);
    document.querySelectorAll(".period-btn").forEach(b => {
        b.classList.toggle("selected", periodModalState.periods.some(x => x.period === parseInt(b.textContent)));
    });
}

function selectMinutes(m) {
    periodModalState.periods.forEach(p => p.minutes = m);
    document.querySelectorAll(".minutes-btn").forEach(b => {
        b.classList.toggle("selected", parseInt(b.textContent.replace("+", "")) === m);
    });
}

function confirmPeriodSelection() {
    if (periodModalState.periods.length === 0) return alert("اختر حصة واحدة على الأقل");
    if (periodModalState.mode === "late") {
        for (const p of periodModalState.periods) { if (!p.minutes) return alert("اختر الدقائق للحصة " + p.period); }
    }
    const sid = periodModalState.studentId;
    if (!State.dailySelections[sid]) State.dailySelections[sid] = { status: "present", escapes: [], lates: [] };
    if (periodModalState.mode === "escape") State.dailySelections[sid].escapes = periodModalState.periods.map(p => ({ period: p.period }));
    else State.dailySelections[sid].lates = periodModalState.periods.map(p => ({ period: p.period, minutes: p.minutes }));
    closePeriodModal(); renderDailyTable(); updateDailyCounters();
}

function cancelPeriodSelection() { closePeriodModal(); }
function closePeriodModal() { document.getElementById("periodModal").classList.remove("show", "escape-mode", "late-mode"); periodModalState = { studentId: null, mode: null, periods: [] }; }

// ===== صفحة الطالب =====
function openStudent(sid) {
    const s = State.students.find(x => x.id === sid);
    if (!s) return;
    const records = State.records.filter(r => r.student_id === sid).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const absent = Attendance.countAbsent(State, sid);
    const excused = Attendance.countExcused(State, sid);
    const escapeHours = Attendance.countEscapeHours(State, sid);
    const lateHours = Attendance.countLateHours(State, sid);
    const alertTotal = Attendance.countForAlerts(State, sid);
    const color = getStatusColor(alertTotal);
    const status = getStatusText(alertTotal);
    const level = getWarningLevel(alertTotal);
    const classInfo = getClassById(s.classId);

    let recordsHTML = records.length === 0 ? '<div class="empty-state">لا توجد سجلات</div>' :
        '<div class="table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>الحالة</th><th>هروب</th><th>تأخير</th><th>إجراء</th></tr></thead><tbody>' +
        records.map((r, i) => {
            const badge = r.status === "present" ? "✅ حاضر" : r.status === "absent" ? "❌ غائب" : "📝 بعذر";
            const esc = (r.escapes || []).map(e => "ح" + e.period).join("،") || "—";
            const lt = (r.lates || []).map(l => "ح" + l.period + "/" + l.minutes + "د").join("،") || "—";
            return '<tr><td>' + (i + 1) + '</td><td>' + r.date + '</td><td>' + badge + '</td><td>' + esc + '</td><td>' + lt + '</td><td><button class="btn btn-small btn-danger" onclick="deleteRecord(' + r.id + ', ' + sid + ')">🗑️</button></td></tr>';
        }).join("") + '</tbody></table></div>';

    document.getElementById("page-student").innerHTML =
        '<button class="btn btn-secondary" onclick="navigate(\'home\')" style="margin-bottom:15px;">⬅️ العودة</button>' +
        '<div class="student-header row-' + color + '"><h2>' + s.nameAr + '</h2><p class="en-name">' + s.nameEn + '</p>' +
        '<div class="student-stats">' +
            '<div class="stat-box"><span class="stat-num" style="color:var(--red);">' + absent + '</span><span class="stat-lbl">❌ غائب</span></div>' +
            '<div class="stat-box"><span class="stat-num" style="color:var(--excused);">' + excused + '</span><span class="stat-lbl">📝 بعذر</span></div>' +
            '<div class="stat-box"><span class="stat-num" style="color:var(--escape);">' + escapeHours + '</span><span class="stat-lbl">🏃 هروب</span></div>' +
            '<div class="stat-box"><span class="stat-num" style="color:var(--late);">' + lateHours + '</span><span class="stat-lbl">⏰ تأخير</span></div>' +
        '</div>' + 
        '<div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">' +
            (level > 0 ? '<button class="btn btn-warning" onclick="showWarning(' + sid + ')">📨 طباعة إنذار</button>' : '') +
            '<button class="btn" style="background:#25D366; color:white; font-weight:bold;" onclick="sendWhatsApp(' + sid + ')">📱 إرسال إنذار واتساب</button>' +
        '</div>' +
        '</div><h3>📋 السجل الكامل</h3>' + recordsHTML;
    navigate("student");
}

async function deleteRecord(rid, sid) {
    if (!confirm("حذف السجل؟")) return;
    Attendance.deleteRecord(State, rid);
    if (await syncToCloud()) openStudent(sid);
}

// ===== إرسال واتساب =====
function sendWhatsApp(sid) {
    const s = State.students.find(x => x.id === sid);
    if (!s) return;
    
    const total = Attendance.countForAlerts(State, sid);
    const level = getWarningLevel(total);
    const classInfo = getClassById(s.classId);
    
    if (level === 0) { alert("هذا الطالب منتظم ولا يحتاج إنذاراً."); return; }

    let warningType = level === 1 ? "إنذار أول" : level === 2 ? "إنذار ثانٍ" : "إنذار نهائي";
    
    let msg = `*مدرسة الطرة الثانوية للبنين*\n\n`;
    msg += `تحية طيبة لولي أمر الطالب: *${s.nameAr}*\n\n`;
    msg += `نحيطكم علماً بأن ابنكم قد تجاوز عدد أيام الغياب المسموح بها، وقد بلغت حتى تاريخ اليوم *${total} أيام*.\n\n`;
    msg += `⚠️ *${warningType} بغياب الطالب*\n\n`;
    msg += `الصف: ${classInfo ? classInfo.name : ''}\n`;
    msg += `رقم الطالب: ${s.number}\n\n`;
    msg += `نرجو من سيادتكم التكرم بمتابعة دوام ابنكم، والتواصل مع إدارة المدرسة في أقرب وقت.\n\n`;
    msg += `ولكم منا فائق الاحترام والتقدير.`;

    const encodedMsg = encodeURIComponent(msg);
    window.open('https://wa.me/?text=' + encodedMsg, '_blank');
}

// ===== التقارير =====
function renderReports() {
    const start = document.getElementById("repStart").value;
    const end = document.getElementById("repEnd").value;
    const mode = document.getElementById("repMode").value;
    const container = document.getElementById("reportsContainer");
    if (!State.currentClassId) return;
    const rows = Reports.generate(State, State.currentClassId, start, end, mode);
    State.reportsCache = { rows, start, end };
    const classInfo = getClassById(State.currentClassId);
    document.getElementById("reportsSummary").innerHTML = '📅 من <strong>' + start + '</strong> إلى <strong>' + end + '</strong> — ' + classInfo.name;
    container.innerHTML = '<div class="table-wrap"><table><thead><tr><th>#</th><th>الطالب</th><th>غياب</th><th>بعذر</th><th>هروب</th><th>تأخير</th><th>دقائق</th><th>الحالة</th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr class="row-' + r.color + '"><td>' + (i + 1) + '</td><td>' + r.nameAr + '</td><td>' + r.absent + '</td><td>' + r.excused + '</td><td>' + r.escapeHours + '</td><td>' + r.lateHours + '</td><td>' + r.lateMinutes + '</td><td>' + r.status + '</td></tr>').join("") +
        '</tbody></table></div>';
}

function exportReportCSV() { if (State.reportsCache && State.currentClassId) Reports.exportCSV(State.reportsCache.rows, getClassById(State.currentClassId).short, State.reportsCache.start, State.reportsCache.end); }

// ===== التنبيهات =====
function renderAlerts() {
    if (!State.currentClassId) return;
    const students = Students.getByClass(State, State.currentClassId);
    const alerts = students.map(s => ({ s, total: Attendance.countForAlerts(State, s.id) })).filter(x => x.total >= WARNING_THRESHOLD).sort((a, b) => b.total - a.total);
    if (alerts.length === 0) { document.getElementById("alertsList").innerHTML = '<div class="empty-state">لا توجد تنبيهات</div>'; return; }
    document.getElementById("alertsList").innerHTML = alerts.map(x => {
        const color = getStatusColor(x.total);
        return '<div class="alert alert-' + (color === "red" ? "error" : color === "orange" ? "warning" : "info") + '">' +
            '<strong>' + x.s.nameAr + '</strong> — ' + x.total + ' أيام غياب — ' + getStatusText(x.total) +
            '<button class="btn btn-small btn-warning" onclick="showWarning(' + x.s.id + ')">📨</button></div>';
    }).join("");
}

// ===== الإدارة =====
function renderAdminStudents() {
    const select = document.getElementById("adminClassSelect");
    if (!select) return;
    if (!select.innerHTML.trim()) select.innerHTML = CLASSES.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join("");
    const students = Students.getByClass(State, select.value || CLASSES[0].id);
    const tbody = document.getElementById("adminStudentsTable");
    tbody.innerHTML = students.length === 0 ? '<tr><td colspan="5">لا يوجد طلاب</td></tr>' : "";
    students.forEach((s, i) => {
        tbody.innerHTML += '<tr><td>' + (i + 1) + '</td><td>' + s.nameAr + '</td><td>' + s.nameEn + '</td><td>' + s.number + '</td><td><button class="btn btn-small btn-danger" onclick="removeStudent(' + s.id + ')">🗑️</button></td></tr>';
    });
}

function addStudentManual() {
    const cid = document.getElementById("adminClassSelect").value;
    const ar = document.getElementById("addNameAr").value.trim();
    const en = document.getElementById("addNameEn").value.trim();
    const num = document.getElementById("addNumber").value.trim();
    const msg = document.getElementById("addStudentMsg");
    if (!ar || !num) return msg.innerHTML = '❌ املأ الحقول';
    const res = Students.add(State, cid, ar, en, num);
    if (res.ok) { msg.innerHTML = '✅ تم'; document.getElementById("addNameAr").value = ""; document.getElementById("addNameEn").value = ""; document.getElementById("addNumber").value = ""; autoSave(300); renderAdminStudents(); setTimeout(() => msg.innerHTML = "", 3000); }
    else msg.innerHTML = '❌ ' + res.msg;
}

function removeStudent(sid) { if (confirm("حذف الطالب؟")) { Students.remove(State, sid); autoSave(300); renderAdminStudents(); } }

function importFromExcel() {
    const cid = document.getElementById("adminClassSelect").value;
    const file = document.getElementById("excelFile");
    const msg = document.getElementById("importMsg");
    if (!file.files[0]) return msg.innerHTML = '❌ اختر ملف';
    Students.importFromFile(State, cid, file.files[0], function(res) {
        if (!res.ok) return msg.innerHTML = '❌ ' + res.msg;
        msg.innerHTML = '✅ تم استيراد ' + res.added;
        file.value = ""; autoSave(300); renderAdminStudents();
    });
}

// ===== إدارة المستخدمين =====
function renderAdminUsers() {
    const select = document.getElementById("newClassId");
    if (select && !select.innerHTML.trim()) {
        select.innerHTML = '<option value="">— بدون —</option>' + 
            CLASSES.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join("");
    }
    
    const tbody = document.getElementById("usersTable");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    Object.keys(State.users).forEach(username => {
        const u = State.users[username];
        
        // إظهار الأزرار للجميع، ولكن سيتم التحقق من الصلاحية عند الضغط
        let actionButtons = 
            '<button class="btn btn-small btn-warning" onclick="changeUserPassword(\'' + username + '\')">🔑 كلمة المرور</button> ' +
            '<button class="btn btn-small btn-info" onclick="openEditUserModal(\'' + username + '\')">✏️ تعديل</button>';

        const tr = document.createElement("tr");
        tr.innerHTML =
            '<td><strong>' + username + '</strong></td>' +
            '<td>' + u.name + '</td>' +
            '<td>' + (u.role === "admin" ? "👑 مدير" : "👨‍🏫 معلم") + '</td>' +
            '<td>' + (u.classId || '—') + '</td>' +
            '<td>' + actionButtons + '</td>';
        tbody.appendChild(tr);
    });
}

function openEditUserModal(username) {
    // التحقق: هل الشخص الذي يفتح النافذة هو مدير؟
    if (!State.currentUser || State.currentUser.role !== 'admin') {
        alert("❌ عذراً، هذه الصلاحية للمدير فقط.");
        return;
    }
    
    const user = State.users[username];
    if (!user) return;
    
    document.getElementById("editUserUsername").value = username;
    document.getElementById("editUserName").value = user.name;
    document.getElementById("editUserPassword").value = user.password;
    document.getElementById("editUserTarget").textContent = "حساب: " + username;
    document.getElementById("editUserModal").style.display = "flex";
}

function addUserManual() {
    const un = document.getElementById("newUsername").value.trim();
    const pw = document.getElementById("newPassword").value.trim();
    const nm = document.getElementById("newFullName").value.trim();
    const ro = document.getElementById("newRole").value;
    const ci = document.getElementById("newClassId").value;
    const msg = document.getElementById("addUserMsg");
    const res = Admin.addUser(State, un, pw, nm, ro, ci);
    if (res.ok) { msg.innerHTML = '✅'; document.getElementById("newUsername").value = ""; document.getElementById("newPassword").value = ""; autoSave(300); renderAdminUsers(); }
    else msg.innerHTML = '❌ ' + res.msg;
}

function changeUserPassword(u) { const p = prompt("كلمة المرور الجديدة لـ " + u); if (p) { Admin.changePassword(State, u, p); autoSave(300); } }
function removeUser(u) { if (confirm("حذف " + u + "؟")) { Admin.removeUser(State, u); autoSave(300); renderAdminUsers(); } }

// ===== نافذة تعديل المستخدم =====
function openEditUserModal(username) {
    const user = State.users[username];
    if (!user) return;
    document.getElementById("editUserUsername").value = username;
    document.getElementById("editUserName").value = user.name;
    document.getElementById("editUserPassword").value = user.password;
    document.getElementById("editUserTarget").textContent = "حساب: " + username;
    document.getElementById("editUserModal").style.display = "flex";
}

function closeEditUserModal() {
    document.getElementById("editUserModal").style.display = "none";
}

async function saveUserEdit() {
    const username = document.getElementById("editUserUsername").value;
    const newName = document.getElementById("editUserName").value.trim();
    const newPassword = document.getElementById("editUserPassword").value.trim();

    if (!newName) return alert("❌ يجب إدخال الاسم");
    State.users[username].name = newName;
    if (newPassword) State.users[username].password = newPassword;

    if (await syncToCloud()) {
        alert("✅ تم تعديل البيانات بنجاح");
        closeEditUserModal();
        renderAdminUsers();
    }
}

// ===== النسخ الاحتياطي =====
function exportBackup() { const b = new Blob([JSON.stringify(State, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "btec_backup.json"; a.click(); }
async function importBackup() {
    const f = document.getElementById("importFile").files[0]; if (!f) return;
    if (!confirm("استبدال البيانات؟")) return;
    const r = new FileReader();
    r.onload = async e => { try { const d = JSON.parse(e.target.result); State.students = d.students; State.records = d.records; State.users = d.users || DEFAULT_USERS; if (await syncToCloud()) { renderAll(); alert("✅"); } } catch(err) { alert(err); } };
    r.readAsText(f);
}

function renderAll() { renderClassSelector(); renderStats(); renderStudentsTable(); renderReports(); renderAlerts(); const b = document.getElementById("todayBadge"); if (b) b.textContent = "📅 " + todayISO(); }

// ===== الدخول =====
(function() {
    function init() {
        document.getElementById("loginBtn").addEventListener("click", () => {
            const u = document.getElementById("usernameInput").value.trim();
            const p = document.getElementById("passwordInput").value.trim();
            const users = State.users && Object.keys(State.users).length ? State.users : DEFAULT_USERS;
            if (users[u] && users[u].password === p) {
                State.currentUser = Object.assign({ username: u }, users[u]);
                State.currentClassId = users[u].role === "admin" ? CLASSES[0].id : users[u].classId;
                localStorage.setItem(CLOUD_CONFIG.SESSION_KEY, JSON.stringify({ username: u }));
                document.getElementById("loginScreen").classList.add("hidden");
                document.getElementById("mainApp").style.display = "block";
                document.getElementById("userBadge").textContent = users[u].name;
                if (users[u].role !== "admin") document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
                startApp();
            } else { document.getElementById("loginError").classList.add("show"); }
        });
        document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.removeItem(CLOUD_CONFIG.SESSION_KEY); location.reload(); });
        const s = Cloud.getSettings();
        if (s && s.masterKey && s.binId) {
            document.getElementById("setupStep").style.display = "none";
            document.getElementById("passwordStep").style.display = "block";
            loadData();
        } else { document.getElementById("setupStep").style.display = "block"; }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

async function startApp() {
    await loadData();
    document.getElementById("dailyDate").value = State.dailyDate;
    document.getElementById("dailyDate").addEventListener("change", e => { State.dailyDate = e.target.value; renderDailyTable(); });
    document.querySelectorAll(".nav-btn").forEach(btn => { if (btn.dataset.page) btn.addEventListener("click", () => navigate(btn.dataset.page)); });
    renderAll(); navigate("home");
}

// تصدير الدوال
window.openPeriodModal = openPeriodModal; window.selectPeriod = selectPeriod; window.selectMinutes = selectMinutes; window.confirmPeriodSelection = confirmPeriodSelection; window.cancelPeriodSelection = cancelPeriodSelection;
window.setDailyStatus = setDailyStatus; window.navigate = navigate; window.selectClass = selectClass; window.openStudent = openStudent; window.deleteRecord = deleteRecord; window.showWarning = showWarning; window.sendWhatsApp = sendWhatsApp;
window.saveDailyRecord = saveDailyRecord; window.markAll = markAll; window.resetAll = resetAll; window.setDateToday = setDateToday; window.changeDay = changeDay;
window.renderReports = renderReports; window.exportReportCSV = exportReportCSV; window.addStudentManual = addStudentManual; window.removeStudent = removeStudent; window.importFromExcel = importFromExcel;
window.addUserManual = addUserManual; window.changeUserPassword = changeUserPassword; window.removeUser = removeUser; window.exportBackup = exportBackup; window.importBackup = importBackup; window.syncFromCloud = syncToCloud;
window.openEditUserModal = openEditUserModal; window.closeEditUserModal = closeEditUserModal; window.saveUserEdit = saveUserEdit;

// ===== نافذة الإنذار وطباعته =====
function showWarning(sid) {
    const s = State.students.find(x => x.id === sid);
    if (!s) return;
    
    // حساب الغياب (بالاعتماد على حالة الغياب فقط، بدون الهروب والتأخير)
    const total = Attendance.countForWarnings(State, sid);
    const level = getWarningLevel(total);
    
    if (level === 0) { 
        alert("هذا الطالب منتظم ولا يحتاج إنذاراً."); 
        return; 
    }
    
    const absentDates = Attendance.getAbsentDates(State, sid);
    const warningDate = todayISO();
    const warningNumber = "غ/م/" + warningDate.replace(/-/g, "") + "/" + sid;
    const classInfo = getClassById(s.classId);
    const teacher = classInfo ? classInfo.teacher : "—";
    const quality = classInfo ? classInfo.quality : "—";

    let detailsHTML = "";
    if (absentDates.length > 0) {
        detailsHTML = "<p><strong>أيام الغياب:</strong></p>" +
            "<p style=\"text-indent:0; background:#f8f9fa; padding:10px 15px; border-right:3px solid #dc3545; border-radius:5px; font-family:'Courier New', monospace; direction:ltr; text-align:left; font-size:0.92em;\">" + absentDates.join(" - ") + "</p>";
    }

    let titleText = "", titleClass = "", body = "", rec = "";
    
    if (level === 1) {
        titleText = "📌 إنذار أول بغياب الطالب"; titleClass = "level-1";
        body = "<p>تحية طيبة وبعد،</p>" +
            "<p>يُهدي مدير " + SCHOOL_INFO.name + " إليكم أطيب التحيات.</p>" +
            "<p>نلفت عنايتكم إلى أن الطالب/ <strong>" + s.nameAr + "</strong>، صاحب الرقم <strong>" + s.number + "</strong>، قد تجاوز عدد أيام غيابه الحد المسموح، حيث بلغ <span class=\"number-badge\">" + total + " أيام</span>، وهي " + numberToArabicWords(total) + ".</p>" +
            detailsHTML +
            "<p>وحرصًا منا على مصلحة الطالب، نرجو متابعة ابنكم وحثّه على الالتزام بالدوام.</p>";
        rec = "<h4>📋 التوصيات:</h4><ul><li>متابعة دوام ابنكم اليومي.</li><li>التواصل مع مربي الصف.</li><li>حثّ الطالب على الالتزام بالدوام.</li></ul>";
    } else if (level === 2) {
        titleText = "⚠️ إنذار ثانٍ بغياب الطالب"; titleClass = "level-2";
        body = "<p>تحية طيبة وبعد،</p>" +
            "<p>بالإشارة إلى الإنذار الأول، واستمرار الطالب/ <strong>" + s.nameAr + "</strong>، صاحب الرقم <strong>" + s.number + "</strong>، في الغياب، نلفت عنايتكم إلى أن عدد أيام غيابه بلغ <span class=\"number-badge\">" + total + " يومًا</span>.</p>" +
            detailsHTML +
            "<p>نرجو سرعة التواصل مع إدارة المدرسة خلال <strong>ثلاثة أيام</strong>.</p>";
        rec = "<h4>⚠️ التوصيات العاجلة:</h4><ul><li>الحضور إلى المدرسة للاجتماع مع المربي والإدارة.</li><li>تقديم الأعذار الرسمية إن وُجدت.</li><li>المتابعة اليومية لدوام الطالب.</li></ul>";
    } else {
        titleText = "🚨 إنذار نهائي بغياب الطالب"; titleClass = "level-3";
        body = "<p>تحية طيبة وبعد،</p>" +
            "<p>بعد استنفاد الإنذارات السابقة، واستمرار الطالب/ <strong>" + s.nameAr + "</strong>، صاحب الرقم <strong>" + s.number + "</strong>، في التغيب، نلفت عنايتكم إلى أن عدد أيام غيابه بلغ <span class=\"number-badge\">" + total + " يومًا</span>، وهو تجاوز جسيم للتعليمات.</p>" +
            detailsHTML +
            "<p>لذا نُرسل إليكم <strong style=\"color:#dc3545;\">الإنذار النهائي</strong>، وفي حال استمرار الغياب سنضطر لرفع الأمر إلى مديرية التربية.</p>";
        rec = "<h4>🚨 إجراءات عاجلة:</h4><ul><li><strong>الحضور الفوري للمدرسة</strong> خلال يومين.</li><li>تقديم الأعذار الرسمية مصدّقة.</li><li>التوقيع على تعهد خطي.</li><li>في حال عدم الاستجابة: رفع الأمر لمديرية التربية.</li></ul>";
    }

    const html =
        '<div class="letterhead"><div class="school-name">' + SCHOOL_INFO.name + '</div>' +
        '<div class="school-info">' + SCHOOL_INFO.ministry + ' — ' + SCHOOL_INFO.directorate + '</div>' +
        '<div class="school-info">العام الدراسي: ' + SCHOOL_INFO.year + ' — ' + (classInfo ? classInfo.name : '') + '</div>' +
        '<div class="ref"><span>الرقم: ' + warningNumber + '</span><span>التاريخ: ' + warningDate + '</span></div></div>' +
        '<div class="warning-title ' + titleClass + '">' + titleText + '</div>' +
        '<div style="text-align:center; margin-bottom:20px;"><strong>المكرم ولي أمر الطالب / ' + s.nameAr + '</strong></div>' +
        '<div class="student-info-box"><table><tr><td class="label">اسم الطالب:</td><td>' + s.nameAr + '</td><td class="label">رقم الطالب:</td><td>' + s.number + '</td></tr>' +
        '<tr><td class="label">الصف:</td><td>' + (classInfo ? classInfo.name : '') + '</td><td class="label">أيام الغياب:</td><td><strong style="color:#dc3545;">' + total + ' يومًا</strong></td></tr></table></div>' +
        '<div class="warning-body">' + body + '</div>' +
        '<div class="recommendations">' + rec + '</div>' +
        '<p style="text-align:center; margin-top:25px; font-weight:600; color:#1e3c72;">وتفضلوا بقبول فائق الاحترام</p>' +
        '<div class="signatures">' +
            '<div class="sig-box"><div class="sig-title">مربي الصف</div><div class="sig-line">' + teacher + '</div></div>' +
            '<div class="sig-box"><div class="sig-title">ضابط الجودة</div><div class="sig-line">' + quality + '</div></div>' +
            '<div class="sig-box"><div class="sig-title">مدير المدرسة</div><div class="sig-line">' + SCHOOL_INFO.principal + '</div></div>' +
        '</div>' +
        '<div class="warning-date">حُرِّر في: ' + warningDate + '</div>' +
        '<div class="warning-actions"><button class="btn btn-primary" onclick="window.print()">🖨️ طباعة</button><button class="btn btn-secondary" onclick="closeWarning()">✖️ إغلاق</button></div>';

    document.getElementById("warningPaper").innerHTML = html;
    document.getElementById("warningModal").classList.add("show");
}

function closeWarning() { 
    document.getElementById("warningModal").classList.remove("show"); 
}

// ===== إرسال واتساب للغياب اليومي =====
function sendAbsentWhatsApp(sid) {
    const s = State.students.find(x => x.id === sid);
    if (!s) return;
    
    const classInfo = getClassById(s.classId);
    const dateStr = formatDateAr(State.dailyDate);

    let msg = `*مدرسة الطرة الثانوية للبنين*\n\n`;
    msg += `تحية طيبة لولي أمر الطالب: *${s.nameAr}*\n\n`;
    msg += `نحيطكم علماً بأن ابنكم قد تغيب اليوم (${dateStr}) عن الدوام المدرسي.\n\n`;
    msg += `الصف: ${classInfo ? classInfo.name : ''}\n`;
    msg += `نرجو من سيادتكم التكرم بتزويدنا بعذر الغياب، أو التواصل مع إدارة المدرسة.\n\n`;
    msg += `ولكم منا فائق الاحترام والتقدير.`;

    const encodedMsg = encodeURIComponent(msg);
    window.open('https://wa.me/?text=' + encodedMsg, '_blank');
}

window.startApp = startApp;
