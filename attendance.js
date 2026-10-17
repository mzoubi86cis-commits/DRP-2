/* ==========================================================================
   attendance.js - إدارة الحضور والغياب
   ========================================================================== */

const Attendance = {

    // جلب سجلات يوم معين لصف معين
    getDayRecords: function(state, classId, date) {
        const classStudents = Students.getByClass(state, classId).map(function(s) { return s.id; });
        return state.records.filter(function(r) {
            return r.date === date && classStudents.indexOf(r.student_id) !== -1;
        });
    },

    // حفظ سجلات اليوم (يدعم حالة واحدة + هروب/تأخير إضافيين)
    saveDay: function(state, classId, date, selections) {
        const classStudents = Students.getByClass(state, classId).map(function(s) { return s.id; });

        // حذف سجلات نفس اليوم لهذا الصف
        state.records = state.records.filter(function(r) {
            return !(r.date === date && classStudents.indexOf(r.student_id) !== -1);
        });

        let maxId = state.records.reduce(function(m, r) { return Math.max(m, r.id || 0); }, 0);

        for (const entry of Object.entries(selections)) {
            const sid = parseInt(entry[0]);
            if (classStudents.indexOf(sid) === -1) continue;

            const value = entry[1];
            
            // دعم نوعين من القيم:
            // 1) نص: "present" / "absent" / "excused"
            // 2) كائن: { status, escapes: [], lates: [] }
            
            let status = "present";
            let escapes = [];  // [{period}]
            let lates = [];    // [{period, minutes}]
            let note = "";

            if (typeof value === "string") {
                status = value;
            } else if (value && typeof value === "object") {
                status = value.status || "present";
                escapes = value.escapes || [];
                lates = value.lates || [];
                note = value.note || "";
            }

            maxId++;
            state.records.push({
                id: maxId,
                student_id: sid,
                date: date,
                status: status,
                escapes: escapes,     // مصفوفة حصص الهروب
                lates: lates,         // مصفوفة حصص التأخير
                note: note
            });
        }
        return true;
    },

    // حذف سجل
    deleteRecord: function(state, recordId) {
        state.records = state.records.filter(function(r) { return r.id !== recordId; });
        return true;
    },

    // ===== عدّادات =====

    // عدد أيام الغياب (بدون عذر)
    countAbsent: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.ABSENT;
        }).length;
    },

    // عدد أيام بعذر
    countExcused: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.EXCUSED;
        }).length;
    },

    // عدد الحصص المهروبة
    countEscapeHours: function(state, studentId) {
        let total = 0;
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.escapes && Array.isArray(r.escapes)) {
                total += r.escapes.length;
            }
        });
        return total;
    },

    // عدد أيام الهروب (بغض النظر عن عدد الحصص)
    countEscapeDays: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.escapes && r.escapes.length > 0;
        }).length;
    },

    // عدد الحصص المتأخرة
    countLateHours: function(state, studentId) {
        let total = 0;
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.lates && Array.isArray(r.lates)) {
                total += r.lates.length;
            }
        });
        return total;
    },

    // مجموع دقائق التأخير
    countLateMinutes: function(state, studentId) {
        let total = 0;
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.lates && Array.isArray(r.lates)) {
                r.lates.forEach(function(l) {
                    total += (l.minutes || 0);
                });
            }
        });
        return total;
    },

    // ===== المجموع في التنبيهات =====
    countForAlerts: function(state, studentId) {
        // فقط الغياب الكامل بدون عذر
        return Attendance.countAbsent(state, studentId);
    },

    // ===== المجموع في الإنذارات =====
    countForWarnings: function(state, studentId) {
        // فقط الغياب الكامل بدون عذر
        return Attendance.countAbsent(state, studentId);
    },

    // ===== التواريخ =====

    getAbsentDates: function(state, studentId) {
        return state.records
            .filter(function(r) {
                return r.student_id === studentId && r.status === STATUS.ABSENT;
            })
            .map(function(r) { return r.date; })
            .sort();
    },

    getExcusedDates: function(state, studentId) {
        return state.records
            .filter(function(r) {
                return r.student_id === studentId && r.status === STATUS.EXCUSED;
            })
            .map(function(r) { return r.date; })
            .sort();
    },

    // تفاصيل الهروب
    getEscapeDetails: function(state, studentId) {
        const result = [];
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.escapes && Array.isArray(r.escapes)) {
                r.escapes.forEach(function(e) {
                    result.push({
                        date: r.date,
                        period: e.period || "—"
                    });
                });
            }
        });
        return result.sort(function(a, b) { return a.date.localeCompare(b.date); });
    },

    // تفاصيل التأخير
    getLateDetails: function(state, studentId) {
        const result = [];
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.lates && Array.isArray(r.lates)) {
                r.lates.forEach(function(l) {
                    result.push({
                        date: r.date,
                        period: l.period || "—",
                        minutes: l.minutes || 0
                    });
                });
            }
        });
        return result.sort(function(a, b) { return a.date.localeCompare(b.date); });
    }
};
