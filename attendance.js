/* ==========================================================================
   attendance.js - التسجيل اليومي
   ========================================================================== */

const Attendance = {

    // الحصول على سجلات يوم معين لصف معين
    getDayRecords: function(state, classId, date) {
        const classStudents = Students.getByClass(state, classId).map(function(s) { return s.id; });
        return state.records.filter(function(r) {
            return r.date === date && classStudents.indexOf(r.student_id) !== -1;
        });
    },

    // حفظ سجلات اليوم
    saveDay: function(state, classId, date, selections) {
        const classStudents = Students.getByClass(state, classId).map(function(s) { return s.id; });

        // حذف السجلات القديمة لهذا اليوم
        state.records = state.records.filter(function(r) {
            return !(r.date === date && classStudents.indexOf(r.student_id) !== -1);
        });

        // إضافة السجلات الجديدة
        let maxId = state.records.reduce(function(m, r) { return Math.max(m, r.id || 0); }, 0);
        for (const entry of Object.entries(selections)) {
            const sid = parseInt(entry[0]);
            if (classStudents.indexOf(sid) === -1) continue;

            const value = entry[1];
            // دعم النوعين: نص بسيط أو كائن {status, period, minutes}
            let status, period = null, minutes = null;

            if (typeof value === "string") {
                status = value;
            } else if (value && typeof value === "object") {
                status = value.status;
                period = value.period || null;
                minutes = value.minutes || null;
            } else {
                continue;
            }

            maxId++;
            state.records.push({
                id: maxId,
                student_id: sid,
                date: date,
                status: status,
                period: period,
                minutes: minutes,
                note: ""
            });
        }
        return true;
    },

    // حذف سجل واحد
    deleteRecord: function(state, recordId) {
        state.records = state.records.filter(function(r) { return r.id !== recordId; });
        return true;
    },

    // ===== العدّادات =====

    // عدد الغياب بدون عذر
    countAbsent: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.ABSENT;
        }).length;
    },

    // عدد الغياب بعذر
    countExcused: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.EXCUSED;
        }).length;
    },

    // عدد الهروب
    countEscape: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.ESCAPE;
        }).length;
    },

    // عدد التأخير
    countLate: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.LATE;
        }).length;
    },

    // المجموع الكلي (للإحصائيات)
    countAll: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId &&
                   (r.status === STATUS.ABSENT ||
                    r.status === STATUS.EXCUSED ||
                    r.status === STATUS.ESCAPE ||
                    r.status === STATUS.LATE);
        }).length;
    },

    // ===== المجموع في التنبيهات (حسب الإعدادات) =====
    countForAlerts: function(state, studentId) {
        let total = Attendance.countAbsent(state, studentId);
        if (COUNT_IN_ALERTS.ESCAPE) total += Attendance.countEscape(state, studentId);
        if (COUNT_IN_ALERTS.LATE)   total += Attendance.countLate(state, studentId);
        return total;
    },

    // ===== المجموع في الإنذار الرسمي (حسب الإعدادات) =====
    countForWarnings: function(state, studentId) {
        let total = Attendance.countAbsent(state, studentId);
        if (COUNT_IN_WARNINGS.ESCAPE) total += Attendance.countEscape(state, studentId);
        if (COUNT_IN_WARNINGS.LATE)   total += Attendance.countLate(state, studentId);
        return total;
    },

    // ===== تواريخ وحصص الغياب =====

    // تواريخ الغياب بدون عذر
    getAbsentDates: function(state, studentId) {
        return state.records
            .filter(function(r) {
                return r.student_id === studentId && r.status === STATUS.ABSENT;
            })
            .map(function(r) { return r.date; })
            .sort();
    },

    // تفاصيل الهروب (تاريخ + حصة)
    getEscapeDetails: function(state, studentId) {
        return state.records
            .filter(function(r) {
                return r.student_id === studentId && r.status === STATUS.ESCAPE;
            })
            .map(function(r) {
                return { date: r.date, period: r.period || "—" };
            })
            .sort(function(a, b) { return a.date.localeCompare(b.date); });
    },

    // تفاصيل التأخير (تاريخ + حصة + دقائق)
    getLateDetails: function(state, studentId) {
        return state.records
            .filter(function(r) {
                return r.student_id === studentId && r.status === STATUS.LATE;
            })
            .map(function(r) {
                return {
                    date: r.date,
                    period: r.period || "—",
                    minutes: r.minutes || "—"
                };
            })
            .sort(function(a, b) { return a.date.localeCompare(b.date); });
    },

    // تواريخ بعذر
    getExcusedDates: function(state, studentId) {
        return state.records
            .filter(function(r) {
                return r.student_id === studentId && r.status === STATUS.EXCUSED;
            })
            .map(function(r) { return r.date; })
            .sort();
    }
};
