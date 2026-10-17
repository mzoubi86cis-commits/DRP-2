/* ==========================================================================
   app.js - المنطق الرئيسي (النسخة النهائية المصححة)
   ========================================================================== */

const State = {
    students: [],
    records: [],
    users: {},
    currentUser: null,
    currentClassId: null,
    dailyDate: todayISO(),
    dailySelections: {},
    reportsCache: null,
    autoSaveTimer: null
};

function autoSave(delay) {
    delay = delay || 800;
    if (State.autoSaveTimer) clearTimeout(State.autoSaveTimer);
    updateSyncStatus("syncing", "⏳ حفظ تلقائي...");
    State.autoSaveTimer = setTimeout(async function() {
        try {
            await Cloud.save({
                students: State.students,
                records: State.records,
                users: State.users,
                lastUpdate: new Date().toISOString()
            });
            updateSyncStatus("synced", "✅ تم الحفظ");
        } catch (err) {
            console.error("AutoSave error:", err);
            updateSyncStatus("error", "❌ فشل الحفظ");
        }
    }, delay);
}

function updateSyncStatus(status, text) {
    const el = document.getElementById("syncStatus");
    if (!el) return;
    el.className = "sync-badge " + status;
    el.textContent = text;
}

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
        renderAll();
        updateSyncStatus("synced", "✅ متزامن");
        alert("✅ تمت المزامنة");
    } catch (err) {
        updateSyncStatus("error", "❌ فشل التحميل");
        alert("⚠️ فشل التحميل: " + err.message);
    }
}

async function syncToCloud() {
    updateSyncStatus("syncing", "⏳ جارٍ الحفظ...");
    try {
        await Cloud.save({
            students: State.students,
            records: State.records,
            users: State.users,
            lastUpdate: new Date().toISOString()
        });
        updateSyncStatus("synced", "✅ متزامن");
        return true;
    } catch (err) {
        console.error(err);
        updateSyncStatus("error", "❌ فشل الحفظ");
        alert("⚠️ فشل الحفظ: " + err.message);
        return false;
    }
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
            State.students = [];
            State.records = [];
            State.users = DEFAULT_USERS;
            await syncToCloud();
        }
        updateSyncStatus("synced", "✅ متزامن");
    } catch (e) {
        console.error(e);
        State.students = [];
        State.records = [];
        State.users = DEFAULT_USERS;
        updateSyncStatus("error", "⚠️ وضع محلي");
    }
}

function navigate(page) {
    document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");
    document.querySelectorAll(".nav-btn").forEach(function(b) {
        if (b.dataset.page) b.classList.toggle("active", b.dataset.page === page);
    });
    if (page === "home") { renderStats(); renderStudentsTable(); }
    if (page === "daily") { renderDailyTable(); }
    if (page === "reports") { renderReports(); }
    if (page === "alerts") { renderAlerts(); }
    if (page === "students-admin") { renderAdminStudents(); }
    if (page === "users-admin") { renderAdminUsers(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderClassSelector() {
    const container = document.getElementById("classSelector");
    if (!container) return;
    const isAdmin = State.currentUser && State.currentUser.role === "admin";
    const userClassId = State.currentUser ? State.currentUser.classId : null;
    container.innerHTML = CLASSES.map(function(c) {
        const canAccess = isAdmin || (userClassId === c.id);
        const isActive = State.currentClassId === c.id;
        return '<button class="class-tab ' + (isActive ? 'active' : '') + ' ' + (canAccess ? '' : 'locked') + '" ' +
            (canAccess ? 'onclick="selectClass(\'' + c.id + '\')"' : 'disabled') + '>' +
            c.short + '</button>';
    }).join("");
}

function selectClass(classId) {
    State.currentClassId = classId;
    renderClassSelector();
    renderStats();
    renderStudentsTable();
    renderDailyTable();
}

function renderStats() {
    if (!State.currentClassId) {
        document.getElementById("statsCards").innerHTML = '<div class="alert alert-info">اختر صفاً</div>';
        return;
    }
    const students = Students.getByClass(State, State.currentClassId);
    const counts = { green: 0, yellow: 0, orange: 0, red: 0 };
    let tA = 0, tE = 0, tEsc = 0, tLate = 0;

    students.forEach(function(s) {
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

function renderStudentsTable() {
    const tbody = document.getElementById("studentsTable");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!State.currentClassId) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">اختر صفاً</td></tr>';
        return;
    }
    const students = Students.getByClass(State, State.currentClassId);
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">لا يوجد طلاب</td></tr>';
        return;
    }
    students.sort(function(a, b) { return a.id - b.id; }).forEach(function(s) {
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
            '<td>' + s.id + '</td>' +
            '<td><a class="student-link" onclick="openStudent(' + s.id + ')">' + s.nameAr + '</a></td>' +
            '<td>' + s.number + '</td>' +
            '<td><span class="badge badge-red">' + absent + '</span></td>' +
            '<td><span class="badge badge-excused">' + excused + '</span></td>' +
            '<td><span class="badge badge-escape">' + escapeHours + '</span></td>' +
            '<td><span class="badge badge-late">' + lateHours + '</span></td>' +
            '<td>' + status + '</td>' +
            '<td style="white-space:nowrap;">' +
                '<button class="btn btn-small btn-info" onclick="openStudent(' + s.id + ')">📋</button>' +
                (level > 0 ? ' <button class="btn btn-small btn-warning" onclick="showWarning(' + s.id + ')">📨 إنذار</button>' : '') +
            '</td>';
        tbody.appendChild(tr);
    });
}

// ===== التسجيل اليومي =====
function renderDailyTable() {
    const tbody = document.getElementById("dailyTable");
    if (!tbody) return;
    tbody.innerHTML = "";
    State.dailySelections = {};

    if (!State.currentClassId) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">اختر صفاً</td></tr>';
        return;
    }

    const students = Students.getByClass(State, State.currentClassId);
    const classStudentIds = students.map(function(s) { return s.id; });

    // جلب السجلات المحفوظة مسبقاً
    const existing = {};
    State.records.filter(function(r) {
        return r.date === State.dailyDate && classStudentIds.indexOf(r.student_id) !== -1;
    }).forEach(function(r) {
        existing[r.student_id] = {
            status: r.status,
            escapes: r.escapes || [],
            lates: r.lates || []
        };
    });

    students.sort(function(a, b) { return a.id - b.id; }).forEach(function(s) {
        const rec = existing[s.id];
        let status = "present";
        let escapes = [];
        let lates = [];

        if (rec) {
            status = rec.status || "present";
            escapes = rec.escapes || [];
            lates = rec.lates || [];
        }

        State.dailySelections[s.id] = { status: status, escapes: escapes, lates: lates };

        let escapeLabel = "🏃 هروب";
        if (escapes.length > 0) {
            escapeLabel = "🏃 هروب (" + escapes.map(function(e) { return "ح" + e.period; }).join("،") + ")";
        }

        let lateLabel = "⏰ تأخير";
        if (lates.length > 0) {
            lateLabel = "⏰ تأخير (" + lates.map(function(l) { return "ح" + l.period + "/" + l.minutes + "د"; }).join("،") + ")";
        }

        const tr = document.createElement("tr");
        tr.innerHTML =
            '<td>' + s.id + '</td>' +
            '<td>' + s.nameAr + '</td>' +
            '<td>' + s.number + '</td>' +
            '<td><div class="status-group" data-sid="' + s.id + '">' +
                '<button class="status-btn ' + (status === "present" ? "active-present" : "") + '" onclick="setDailyStatus(' + s.id + ', \'present\')">✅ حاضر</button>' +
                '<button class="status-btn ' + (status === "absent" ? "active-absent" : "") + '" onclick="setDailyStatus(' + s.id + ', \'absent\')">❌ غائب</button>' +
                '<button class="status-btn ' + (status === "excused" ? "active-excused" : "") + '" onclick="setDailyStatus(' + s.id + ', \'excused\')">📝 بعذر</button>' +
                '<button class="status-btn ' + (escapes.length > 0 ? "active-escape" : "") + '" onclick="openPeriodModal(' + s.id + ', \'escape\')">' + escapeLabel + '</button>' +
                '<button class="status-btn ' + (lates.length > 0 ? "active-late" : "") + '" onclick="openPeriodModal(' + s.id + ', \'late\')">' + lateLabel + '</button>' +
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
    refreshRowButtons(sid);
    updateDailyCounters();
}

function refreshRowButtons(sid) {
    const group = document.querySelector('.status-group[data-sid="' + sid + '"]');
    if (!group) return;
    const data = State.dailySelections[sid] || { status: "present", escapes: [], lates: [] };
    const buttons = group.querySelectorAll(".status-btn");

    buttons.forEach(function(b) { b.className = "status-btn"; });

    if (data.status === "present") buttons[0].classList.add("active-present");
    if (data.status === "absent")  buttons[1].classList.add("active-absent");
    if (data.status === "excused") buttons[2].classList.add("active-excused");

    const escapes = data.escapes || [];
    const lates = data.lates || [];

    if (escapes.length > 0) {
        buttons[3].classList.add("active-escape");
        buttons[3].textContent = "🏃 هروب (" + escapes.map(function(e) { return "ح" + e.period; }).join("،") + ")";
    } else {
        buttons[3].textContent = "🏃 هروب";
    }

    if (lates.length > 0) {
        buttons[4].classList.add("active-late");
        buttons[4].textContent = "⏰ تأخير (" + lates.map(function(l) { return "ح" + l.period + "/" + l.minutes + "د"; }).join("،") + ")";
    } else {
        buttons[4].textContent = "⏰ تأخير";
    }
}

function updateDailyCounters() {
    let p = 0, a = 0, e = 0, esc = 0, late = 0;
    Object.values(State.dailySelections).forEach(function(d) {
        if (d.status === "present") p++;
        else if (d.status === "absent") a++;
        else if (d.status === "excused") e++;
        if (d.escapes) esc += d.escapes.length;
        if (d.lates) late += d.lates.length;
    });

    document.getElementById("cPresent").textContent = p;
    document.getElementById("cAbsent").textContent = a;
    document.getElementById("cExcused").textContent = e;
    document.getElementById("cEscape").textContent = esc;
    document.getElementById("cLate").textContent = late;
}

function markAll(status) {
    const students = Students.getByClass(State, State.currentClassId);
    students.forEach(function(s) {
        if (!State.dailySelections[s.id]) {
            State.dailySelections[s.id] = { status: status, escapes: [], lates: [] };
        } else {
            State.dailySelections[s.id].status = status;
        }
    });
    students.forEach(function(s) { refreshRowButtons(s.id); });
    updateDailyCounters();
}

function resetAll() {
    const students = Students.getByClass(State, State.currentClassId);
    students.forEach(function(s) {
        State.dailySelections[s.id] = { status: "present", escapes: [], lates: [] };
    });
    students.forEach(function(s) { refreshRowButtons(s.id); });
    updateDailyCounters();
}

function setDateToday() {
    State.dailyDate = todayISO();
    document.getElementById("dailyDate").value = State.dailyDate;
    renderDailyTable();
}

function changeDay(delta) {
    const d = new Date(State.dailyDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    State.dailyDate = d.toISOString().split("T")[0];
    document.getElementById("dailyDate").value = State.dailyDate;
    renderDailyTable();
}

async function saveDailyRecord() {
    if (!State.currentClassId) { alert("اختر صفاً أولاً"); return; }
    const students = Students.getByClass(State, State.currentClassId);
    if (students.length === 0) { alert("لا يوجد طلاب"); return; }

    // التأكد من وجود حالة لكل طالب
    students.forEach(function(s) {
        if (!State.dailySelections[s.id]) {
            State.dailySelections[s.id] = { status: "present", escapes: [], lates: [] };
        }
    });

    // الحفظ
    Attendance.saveDay(State, State.currentClassId, State.dailyDate, State.dailySelections);

    updateSyncStatus("syncing", "⏳ جارٍ الحفظ...");
    const ok = await syncToCloud();
    if (ok) {
        renderAll();
        alert("✅ تم حفظ " + students.length + " سجل بتاريخ " + State.dailyDate);
    }
}

// ===== نافذة اختيار الحصة =====
let periodModalState = {
    studentId: null,
    mode: null,
    periods: [],    // {period, minutes}
};

function openPeriodModal(sid, mode) {
    const s = State.students.find(function(x) { return x.id === sid; });
    if (!s) return;

    const current = State.dailySelections[sid] || { status: "present", escapes: [], lates: [] };
    
    periodModalState = {
        studentId: sid,
        mode: mode,
        periods: []
    };

    // تحميل القيم الحالية
    if (mode === "escape") {
        periodModalState.periods = (current.escapes || []).map(function(e) {
            return { period: e.period, minutes: null };
        });
    } else {
        periodModalState.periods = (current.lates || []).map(function(l) {
            return { period: l.period, minutes: l.minutes };
        });
    }

    const modal = document.getElementById("periodModal");
    const title = document.getElementById("periodModalTitle");
    const studentInfo = document.getElementById("periodModalStudent");
    const minutesSection = document.getElementById("minutesSection");

    if (mode === "escape") {
        title.textContent = "🏃 تسجيل هروب";
        minutesSection.style.display = "none";
        modal.classList.add("escape-mode");
        modal.classList.remove("late-mode");
    } else {
        title.textContent = "⏰ تسجيل تأخير";
        minutesSection.style.display = "block";
        modal.classList.add("late-mode");
        modal.classList.remove("escape-mode");
    }

    studentInfo.textContent = "الطالب: " + s.nameAr;

    // إعادة تعيين الأزرار
    document.querySelectorAll(".period-btn").forEach(function(b) { b.classList.remove("selected"); });
    document.querySelectorAll(".minutes-btn").forEach(function(b) { b.classList.remove("selected"); });

    // تحديد الحصص المحفوظة
    periodModalState.periods.forEach(function(p) {
        document.querySelectorAll(".period-btn").forEach(function(b) {
            if (parseInt(b.textContent) === p.period) b.classList.add("selected");
        });
    });

    modal.classList.add("show");
}

function selectPeriod(p) {
    const idx = periodModalState.periods.findIndex(function(x) { return x.period === p; });
    if (idx === -1) {
        // إضافة حصة جديدة
        periodModalState.periods.push({ period: p, minutes: null });
    } else {
        // إزالة
        periodModalState.periods.splice(idx, 1);
    }

    document.querySelectorAll(".period-btn").forEach(function(b) {
        const val = parseInt(b.textContent);
        const isSelected = periodModalState.periods.some(function(x) { return x.period === val; });
        b.classList.toggle("selected", isSelected);
    });
}

function selectMinutes(m) {
    // تطبيق الدقائق على جميع الحصص المحددة
    periodModalState.periods.forEach(function(p) {
        p.minutes = m;
    });
    document.querySelectorAll(".minutes-btn").forEach(function(b) {
        const val = b.textContent.replace("+", "");
        b.classList.toggle("selected", parseInt(val) === m);
    });
}

function confirmPeriodSelection() {
    if (periodModalState.periods.length === 0) {
        alert("⚠️ يجب تحديد حصة واحدة على الأقل");
        return;
    }
    if (periodModalState.mode === "late") {
        for (const p of periodModalState.periods) {
            if (!p.minutes) {
                alert("⚠️ يجب تحديد الدقائق للحصة " + p.period);
                return;
            }
        }
    }

    const sid = periodModalState.studentId;

    if (!State.dailySelections[sid]) {
        State.dailySelections[sid] = { status: "present", escapes: [], lates: [] };
    }

    if (periodModalState.mode === "escape") {
        State.dailySelections[sid].escapes = periodModalState.periods.map(function(p) {
            return { period: p.period };
        });
    } else {
        State.dailySelections[sid].lates = periodModalState.periods.map(function(p) {
            return { period: p.period, minutes: p.minutes };
        });
    }

    closePeriodModal();
    renderDailyTable();
    updateDailyCounters();
}

function cancelPeriodSelection() {
    closePeriodModal();
}

function closePeriodModal() {
    const modal = document.getElementById("periodModal");
    if (modal) modal.classList.remove("show", "escape-mode", "late-mode");
    periodModalState = { studentId: null, mode: null, periods: [] };
}

// ===== صفحة الطالب =====
function openStudent(sid) {
    const s = State.students.find(function(x) { return x.id === sid; });
    if (!s) return;
    const records = State.records.filter(function(r) { return r.student_id === sid; })
                                 .sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    const absent = Attendance.countAbsent(State, sid);
    const excused = Attendance.countExcused(State, sid);
    const escapeHours = Attendance.countEscapeHours(State, sid);
    const lateHours = Attendance.countLateHours(State, sid);
    const lateMinutes = Attendance.countLateMinutes(State, sid);
    const alertTotal = Attendance.countForAlerts(State, sid);
    const color = getStatusColor(alertTotal);
    const status = getStatusText(alertTotal);
    const level = getWarningLevel(alertTotal);
    const classInfo = getClassById(s.classId);

    function statusBadge(r) {
        if (r.status === "present") return '<span class="badge badge-green">✅ حاضر</span>';
        if (r.status === "absent")  return '<span class="badge badge-red">❌ غائب</span>';
        if (r.status === "excused") return '<span class="badge badge-excused">📝 بعذر</span>';
        return "-";
    }

    let recordsHTML = "";
    if (records.length === 0) {
        recordsHTML = '<div class="empty-state"><span class="icon">🎉</span>لا توجد سجلات</div>';
    } else {
        recordsHTML = '<div class="table-wrap"><table><thead><tr>' +
            '<th style="width:50px;">#</th><th>التاريخ</th><th>اليوم</th><th>الحالة</th><th>هروب</th><th>تأخير</th><th>إجراء</th>' +
            '</tr></thead><tbody>';
        records.forEach(function(r, i) {
            const esc = (r.escapes || []).map(function(e) { return "ح" + e.period; }).join("،") || "—";
            const lt = (r.lates || []).map(function(l) { return "ح" + l.period + "/" + l.minutes + "د"; }).join("،") || "—";

            recordsHTML += '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + r.date + '</td>' +
                '<td>' + formatDateAr(r.date).split("(")[1].replace(")", "") + '</td>' +
                '<td>' + statusBadge(r) + '</td>' +
                '<td style="color:var(--escape);">' + esc + '</td>' +
                '<td style="color:var(--late);">' + lt + '</td>' +
                '<td><button class="btn btn-small btn-danger" onclick="deleteRecord(' + r.id + ', ' + sid + ')">🗑️</button></td>' +
                '</tr>';
        });
        recordsHTML += '</tbody></table></div>';
    }

    const page = document.getElementById("page-student");
    page.innerHTML =
        '<button class="btn btn-secondary" onclick="navigate(\'home\')" style="margin-bottom:15px;">⬅️ العودة</button>' +
        '<div class="student-header row-' + color + '">' +
            '<h2>' + s.nameAr + '</h2>' +
            '<p class="en-name">' + s.nameEn + '</p>' +
            '<p>رقم الطالب: <strong>' + s.number + '</strong> | الصف: <strong>' + (classInfo ? classInfo.name : '') + '</strong></p>' +
            '<div class="student-stats">' +
                '<div class="stat-box"><span class="stat-num" style="color:var(--red);">' + absent + '</span><span class="stat-lbl">❌ غائب</span></div>' +
                '<div class="stat-box"><span class="stat-num" style="color:var(--excused);">' + excused + '</span><span class="stat-lbl">📝 بعذر</span></div>' +
                '<div class="stat-box"><span class="stat-num" style="color:var(--escape);">' + escapeHours + '</span><span class="stat-lbl">🏃 حصص هروب</span></div>' +
                '<div class="stat-box"><span class="stat-num" style="color:var(--late);">' + lateHours + '</span><span class="stat-lbl">⏰ حصص تأخير</span></div>' +
                '<div class="stat-box"><span class="stat-num" style="color:var(--late);font-size:1.4em;">' + lateMinutes + '</span><span class="stat-lbl">دقيقة تأخير</span></div>' +
                '<div class="stat-box"><span class="stat-lbl">' + status + '</span></div>' +
            '</div>' +
            (level > 0 ? '<div style="margin-top:15px;"><button class="btn btn-warning" onclick="showWarning(' + sid + ')">📨 طباعة إنذار</button></div>' : '') +
        '</div>' +
        '<h3 style="color:var(--primary-light); margin:20px 0 10px;">📋 السجل الكامل</h3>' +
        recordsHTML;
    navigate("student");
}

async function deleteRecord(rid, sid) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    Attendance.deleteRecord(State, rid);
    const ok = await syncToCloud();
    if (ok) openStudent(sid);
}

function renderReports() {
    const start = document.getElementById("repStart").value;
    const end = document.getElementById("repEnd").value;
    const mode = document.getElementById("repMode").value;

    const container = document.getElementById("reportsContainer");

    if (!State.currentClassId) {
        container.innerHTML = '<div class="alert alert-warning">اختر صفاً أولاً</div>';
        return;
    }

    const rows = Reports.generate(State, State.currentClassId, start, end, mode);
    State.reportsCache = { rows: rows, start: start, end: end };

    const classInfo = getClassById(State.currentClassId);
    document.getElementById("reportsSummary").innerHTML =
        '📅 من <strong>' + start + '</strong> إلى <strong>' + end + '</strong> — ' + classInfo.name + ' — عدد الطلاب: <strong>' + rows.length + '</strong>';

    container.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
        '<th style="width:50px;">#</th><th>اسم الطالب</th><th>رقم الطالب</th>' +
        '<th>غياب</th><th>بعذر</th><th>حصص هروب</th><th>حصص تأخير</th><th>دقائق</th><th>الحالة</th><th>التفاصيل</th>' +
        '</tr></thead><tbody>' +
        rows.map(function(r, i) {
            return '<tr class="row-' + r.color + '"><td>' + (i + 1) + '</td>' +
                '<td><a class="student-link" onclick="openStudent(' + r.id + ')">' + r.nameAr + '</a></td>' +
                '<td>' + r.number + '</td>' +
                '<td><span class="badge badge-red">' + r.absent + '</span></td>' +
                '<td><span class="badge badge-excused">' + r.excused + '</span></td>' +
                '<td><span class="badge badge-escape">' + r.escapeHours + '</span></td>' +
                '<td><span class="badge badge-late">' + r.lateHours + '</span></td>' +
                '<td>' + r.lateMinutes + '</td>' +
                '<td>' + r.status + '</td>' +
                '<td style="font-size:0.75em; color:#555; direction:ltr; text-align:left;">' +
                    (r.displayDates.length ? r.displayDates.slice(0, 10).join(" - ") + (r.displayDates.length > 10 ? " ..." : "") : '<span style="color:#999;">—</span>') +
                '</td></tr>';
        }).join("") +
        '</tbody></table></div>';
}

function exportReportCSV() {
    if (!State.reportsCache || !State.currentClassId) { alert("اعرض التقرير أولاً"); return; }
    const classInfo = getClassById(State.currentClassId);
    Reports.exportCSV(State.reportsCache.rows, classInfo.short, State.reportsCache.start, State.reportsCache.end);
}

function renderAlerts() {
    if (!State.currentClassId) {
        document.getElementById("alertsList").innerHTML = '<div class="alert alert-warning">اختر صفاً</div>';
        return;
    }
    const students = Students.getByClass(State, State.currentClassId);
    const alerts = students.map(function(s) {
        return { s: s, total: Attendance.countForAlerts(State, s.id) };
    }).filter(function(x) { return x.total >= WARNING_THRESHOLD; })
      .sort(function(a, b) { return b.total - a.total; });

    if (alerts.length === 0) {
        document.getElementById("alertsList").innerHTML = '<div class="empty-state"><span class="icon">🎉</span>لا توجد تنبيهات</div>';
        return;
    }

    document.getElementById("alertsList").innerHTML = alerts.map(function(x) {
        const s = x.s, total = x.total;
        const color = getStatusColor(total);
        let msg = "";
        if (color === "red") msg = "🚨 تجاوز الحد الأقصى (" + RED_THRESHOLD + " أيام)";
        else if (color === "orange") msg = "⚠️ تجاوز " + ORANGE_THRESHOLD + " يوم";
        else msg = "🔔 تجاوز " + WARNING_THRESHOLD + " أيام";

        return '<div class="alert alert-' + (color === "red" ? "error" : color === "orange" ? "warning" : "info") + '" style="margin-bottom:12px;">' +
            '<div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; align-items:center;">' +
            '<div><strong>' + s.nameAr + '</strong><div style="font-size:0.85em; color:#666;">' + s.number + '</div><div style="margin-top:6px;">' + msg + '</div></div>' +
            '<div style="text-align:center;"><div style="font-size:2em; font-weight:700;">' + total + '</div><div style="font-size:0.85em;">أيام غياب</div>' +
            '<div style="display:flex; gap:6px; margin-top:8px;"><button class="btn btn-small btn-info" onclick="openStudent(' + s.id + ')">📋</button><button class="btn btn-small btn-warning" onclick="showWarning(' + s.id + ')">📨 إنذار</button></div></div></div></div>';
    }).join("");
}

function renderAdminStudents() {
    const select = document.getElementById("adminClassSelect");
    if (!select) return;
    if (!select.innerHTML.trim()) {
        select.innerHTML = CLASSES.map(function(c) {
            return '<option value="' + c.id + '">' + c.name + '</option>';
        }).join("");
    }
    const classId = select.value || CLASSES[0].id;
    const students = Students.getByClass(State, classId);
    const tbody = document.getElementById("adminStudentsTable");
    tbody.innerHTML = "";

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">لا يوجد طلاب</td></tr>';
        return;
    }

    students.forEach(function(s, i) {
        const tr = document.createElement("tr");
        tr.innerHTML =
            '<td>' + (i + 1) + '</td>' +
            '<td>' + s.nameAr + '</td>' +
            '<td class="en-name">' + s.nameEn + '</td>' +
            '<td>' + s.number + '</td>' +
            '<td><button class="btn btn-small btn-danger" onclick="removeStudent(' + s.id + ')">🗑️</button></td>';
        tbody.appendChild(tr);
    });
}

function addStudentManual() {
    const classId = document.getElementById("adminClassSelect").value;
    const nameAr = document.getElementById("addNameAr").value.trim();
    const nameEn = document.getElementById("addNameEn").value.trim();
    const number = document.getElementById("addNumber").value.trim();
    const msg = document.getElementById("addStudentMsg");

    if (!nameAr || !number) {
        msg.innerHTML = '<span class="error">❌ الاسم ورقم الطالب مطلوبان</span>';
        return;
    }

    const result = Students.add(State, classId, nameAr, nameEn, number);
    if (result.ok) {
        msg.innerHTML = '<span class="success">✅ ' + result.msg + '</span>';
        document.getElementById("addNameAr").value = "";
        document.getElementById("addNameEn").value = "";
        document.getElementById("addNumber").value = "";
        autoSave(300);
        renderAdminStudents();
        setTimeout(function() { msg.innerHTML = ""; }, 3000);
    } else {
        msg.innerHTML = '<span class="error">❌ ' + result.msg + '</span>';
    }
}

function removeStudent(sid) {
    if (!confirm("حذف الطالب وجميع سجلاته؟")) return;
    Students.remove(State, sid);
    autoSave(300);
    renderAdminStudents();
}

function importFromExcel() {
    const classId = document.getElementById("adminClassSelect").value;
    const fileInput = document.getElementById("excelFile");
    const msg = document.getElementById("importMsg");

    if (!fileInput.files[0]) {
        msg.innerHTML = '<span class="error">❌ اختر ملفاً</span>';
        return;
    }

    Students.importFromFile(State, classId, fileInput.files[0], function(result) {
        if (!result.ok) {
            msg.innerHTML = '<span class="error">❌ ' + result.msg + '</span>';
            return;
        }
        let html = '<span class="success">✅ تم استيراد ' + result.added + ' طالب';
        if (result.skipped > 0) html += ' — تم تخطي ' + result.skipped;
        html += '</span>';
        msg.innerHTML = html;
        fileInput.value = "";
        autoSave(300);
        renderAdminStudents();
    });
}

function renderAdminUsers() {
    const select = document.getElementById("newClassId");
    if (select && !select.innerHTML.trim()) {
        select.innerHTML = '<option value="">— بدون —</option>' +
            CLASSES.map(function(c) {
                return '<option value="' + c.id + '">' + c.name + '</option>';
            }).join("");
    }
    const tbody = document.getElementById("usersTable");
    if (!tbody) return;
    tbody.innerHTML = "";

    Object.keys(State.users).forEach(function(username) {
        const u = State.users[username];
        const classInfo = u.classId ? getClassById(u.classId) : null;
        const roleText = u.role === "admin" ? "👑 مدير" : "👨‍🏫 معلم";
        const roleClass = u.role === "admin" ? "badge-admin" : "";

        const tr = document.createElement("tr");
        tr.innerHTML =
            '<td><strong>' + username + '</strong></td>' +
            '<td>' + u.name + '</td>' +
            '<td><span class="badge ' + roleClass + '">' + roleText + '</span></td>' +
            '<td>' + (classInfo ? classInfo.short : '—') + '</td>' +
            '<td>' +
                '<button class="btn btn-small btn-warning" onclick="changeUserPassword(\'' + username + '\')">🔑</button>' +
                (username !== "admin" ? ' <button class="btn btn-small btn-danger" onclick="removeUser(\'' + username + '\')">🗑️</button>' : '') +
            '</td>';
        tbody.appendChild(tr);
    });
}

function addUserManual() {
    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value.trim();
    const name = document.getElementById("newFullName").value.trim();
    const role = document.getElementById("newRole").value;
    const classId = document.getElementById("newClassId").value;
    const msg = document.getElementById("addUserMsg");

    const result = Admin.addUser(State, username, password, name, role, classId);
    if (result.ok) {
        msg.innerHTML = '<span class="success">✅ ' + result.msg + '</span>';
        document.getElementById("newUsername").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("newFullName").value = "";
        autoSave(300);
        renderAdminUsers();
        setTimeout(function() { msg.innerHTML = ""; }, 3000);
    } else {
        msg.innerHTML = '<span class="error">❌ ' + result.msg + '</span>';
    }
}

function changeUserPassword(username) {
    const newPass = prompt("كلمة المرور الجديدة لـ " + username + ":");
    if (!newPass) return;
    const result = Admin.changePassword(State, username, newPass);
    alert(result.msg);
    if (result.ok) autoSave(300);
}

function removeUser(username) {
    if (!confirm("حذف المستخدم " + username + "؟")) return;
    const result = Admin.removeUser(State, username);
    if (result.ok) { autoSave(300); renderAdminUsers(); }
    else alert(result.msg);
}

function showWarning(sid) {
    const s = State.students.find(function(x) { return x.id === sid; });
    if (!s) return;
    const total = Attendance.countForWarnings(State, sid);
    const level = getWarningLevel(total);
    if (level === 0) { alert("هذا الطالب منتظم"); return; }
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

function closeWarning() { document.getElementById("warningModal").classList.remove("show"); }

function exportBackup() {
    const data = {
        version: 3,
        exportDate: new Date().toISOString(),
        students: State.students,
        records: State.records,
        users: State.users
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "btec_backup_" + todayISO() + ".json";
    a.click();
}

async function importBackup() {
    const file = document.getElementById("importFile").files[0];
    if (!file) { alert("اختر ملفاً"); return; }
    if (!confirm("استبدال جميع البيانات؟")) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.students || !data.records) throw new Error("ملف غير صالح");
            State.students = data.students;
            State.records = data.records;
            State.users = data.users || DEFAULT_USERS;
            await syncToCloud();
            renderAll();
            alert("✅ تمت الاستعادة");
        } catch(err) {
            alert("❌ " + err.message);
        }
    };
    reader.readAsText(file);
}

function renderAll() {
    renderClassSelector();
    renderStats();
    renderStudentsTable();
    renderReports();
    renderAlerts();
    const badge = document.getElementById("todayBadge");
    if (badge) badge.textContent = "📅 اليوم: " + todayISO();
}

(function() {
    "use strict";
    const safeStorage = {
        get(k) { try { return localStorage.getItem(k); } catch(e) { return null; } },
        set(k,v) { try { localStorage.setItem(k,v); } catch(e) {} },
        remove(k) { try { localStorage.removeItem(k); } catch(e) {} }
    };

    function showSetup() {
        document.getElementById("setupStep").style.display = "block";
        document.getElementById("passwordStep").style.display = "none";
        const s = Cloud.getSettings();
        if (s) {
            if (s.masterKey) document.getElementById("masterKeyInput").value = s.masterKey;
            if (s.binId) document.getElementById("binIdInput").value = s.binId;
        }
    }

    function showPassword() {
        document.getElementById("setupStep").style.display = "none";
        document.getElementById("passwordStep").style.display = "block";
        setTimeout(function() { 
            const el = document.getElementById("usernameInput");
            if (el) el.focus(); 
        }, 200);
        setTimeout(function() {
            const qrContainer = document.getElementById("qrCode");
            if (qrContainer && typeof QRCode !== "undefined") {
                qrContainer.innerHTML = "";
                new QRCode(qrContainer, {
                    text: window.location.href,
                    width: 140,
                    height: 140,
                    colorDark: "#1e3c72",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }, 300);
    }

    async function saveSetup() {
        const mk = document.getElementById("masterKeyInput").value.trim();
        const bi = document.getElementById("binIdInput").value.trim();
        const err = document.getElementById("setupError");
        err.classList.remove("show");
        if (!mk || !bi) {
            err.textContent = "❌ أدخل جميع الحقول";
            err.classList.add("show");
            return;
        }
        Cloud.saveSettings({ masterKey: mk, binId: bi });
        try {
            await Cloud.load();
            showPassword();
        } catch(e) {
            err.textContent = "❌ فشل الاتصال: " + e.message;
            err.classList.add("show");
            Cloud.clearSettings();
        }
    }

    function checkLogin() {
        const username = document.getElementById("usernameInput").value.trim();
        const password = document.getElementById("passwordInput").value.trim();
        const err = document.getElementById("loginError");
        err.classList.remove("show");
        let users = State.users && Object.keys(State.users).length ? State.users : DEFAULT_USERS;
        const user = users[username];
        if (user && user.password === password) {
            State.currentUser = Object.assign({ username: username }, user);
            State.currentClassId = user.role === "admin" ? CLASSES[0].id : user.classId;
            safeStorage.set(CLOUD_CONFIG.SESSION_KEY, JSON.stringify({ username: username, timestamp: Date.now() }));
            showApp();
        } else {
            err.classList.add("show");
            document.getElementById("passwordInput").value = "";
            document.getElementById("passwordInput").focus();
        }
    }

    async function showApp() {
        document.getElementById("loginScreen").classList.add("hidden");
        document.getElementById("mainApp").style.display = "block";
        const userBadge = document.getElementById("userBadge");
        if (userBadge && State.currentUser) {
            const roleText = State.currentUser.role === "admin" ? "👑" : "👨‍🏫";
            userBadge.textContent = roleText + " " + State.currentUser.name;
        }
        if (State.currentUser && State.currentUser.role !== "admin") {
            document.querySelectorAll(".admin-only").forEach(function(el) { el.classList.add("hidden"); });
        }
        await startApp();
    }

    function logout() {
        if (!confirm("تسجيل الخروج؟")) return;
        safeStorage.remove(CLOUD_CONFIG.SESSION_KEY);
        location.reload();
    }

    function init() {
        const loginBtn = document.getElementById("loginBtn");
        const setupBtn = document.getElementById("setupBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        const resetLink = document.getElementById("resetSettingsLink");
        if (loginBtn) loginBtn.addEventListener("click", checkLogin);
        if (setupBtn) setupBtn.addEventListener("click", saveSetup);
        if (logoutBtn) logoutBtn.addEventListener("click", logout);
        if (resetLink) resetLink.addEventListener("click", function(e) {
            e.preventDefault();
            if (confirm("مسح إعدادات JSONBin؟")) { Cloud.clearSettings(); location.reload(); }
        });
        const pwInput = document.getElementById("passwordInput");
        const userInput = document.getElementById("usernameInput");
        if (pwInput) pwInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") { e.preventDefault(); checkLogin(); }
        });
        if (userInput) userInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") { e.preventDefault(); if (pwInput) pwInput.focus(); }
        });
        const settings = Cloud.getSettings();
        if (!settings || !settings.masterKey || !settings.binId) {
            showSetup();
        } else {
            const session = safeStorage.get(CLOUD_CONFIG.SESSION_KEY);
            if (session) {
                try {
                    const sess = JSON.parse(session);
                    loadData().then(function() {
                        const users = State.users || DEFAULT_USERS;
                        const user = users[sess.username];
                        if (user) {
                            State.currentUser = Object.assign({ username: sess.username }, user);
                            State.currentClassId = user.role === "admin" ? CLASSES[0].id : user.classId;
                            showApp();
                        } else {
                            showPassword();
                        }
                    });
                } catch(e) { showPassword(); }
            } else {
                loadData().then(function() { showPassword(); });
            }
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();

let appStarted = false;

async function startApp() {
    if (appStarted) return;
    appStarted = true;
    try {
        await loadData();
        const ddi = document.getElementById("dailyDate");
        if (ddi) {
            ddi.value = State.dailyDate;
            ddi.addEventListener("change", function(e) {
                State.dailyDate = e.target.value;
                renderDailyTable();
            });
        }
        const acs = document.getElementById("adminClassSelect");
        if (acs) acs.addEventListener("change", renderAdminStudents);
        document.querySelectorAll(".nav-btn").forEach(function(btn) {
            if (btn.dataset.page) {
                btn.addEventListener("click", function() { navigate(btn.dataset.page); });
            }
        });
        const wm = document.getElementById("warningModal");
        if (wm) wm.addEventListener("click", function(e) { if (e.target === wm) closeWarning(); });
        await renderAll();
        navigate("home");
    } catch (err) {
        console.error(err);
        alert("حدث خطأ: " + err.message);
    }
}

window.startApp = startApp;
window.resetCloudSettings = resetCloudSettings;
window.openPeriodModal = openPeriodModal;
window.selectPeriod = selectPeriod;
window.selectMinutes = selectMinutes;
window.confirmPeriodSelection = confirmPeriodSelection;
window.cancelPeriodSelection = cancelPeriodSelection;
window.setDailyStatus = setDailyStatus;
window.navigate = navigate;
window.selectClass = selectClass;
window.openStudent = openStudent;
window.deleteRecord = deleteRecord;
window.showWarning = showWarning;
window.closeWarning = closeWarning;
window.syncFromCloud = syncFromCloud;
window.setDateToday = setDateToday;
window.changeDay = changeDay;
window.saveDailyRecord = saveDailyRecord;
window.markAll = markAll;
window.resetAll = resetAll;
window.renderReports = renderReports;
window.exportReportCSV = exportReportCSV;
window.addStudentManual = addStudentManual;
window.removeStudent = removeStudent;
window.importFromExcel = importFromExcel;
window.addUserManual = addUserManual;
window.changeUserPassword = changeUserPassword;
window.removeUser = removeUser;
window.exportBackup = exportBackup;
window.importBackup = importBackup;

function resetCloudSettings() {
    if (!State.currentUser || State.currentUser.role !== "admin") {
        alert("❌ للمدير فقط");
        return;
    }
    if (!confirm("سيتم حذف إعدادات JSONBin.\n\nالبيانات في السحابة آمنة.\n\nمتابعة؟")) return;
    if (!confirm("تأكيد نهائي؟")) return;
    Cloud.clearSettings();
    try { localStorage.removeItem(CLOUD_CONFIG.SESSION_KEY); } catch(e) {}
    location.reload();
}
