/* ==========================================================================
   attendance.js - إدارة الحضور والغياب (النسخة النهائية)
   ========================================================================== */

const Attendance = {

    getDayRecords: function(state, classId, date) {
        const classStudents = Students.getByClass(state, classId).map(function(s) { return s.id; });
        return state.records.filter(function(r) {
            return r.date === date && classStudents.indexOf(r.student_id) !== -1;
        });
    },

    // ✅ الحفظ المضمون
    saveDay: function(state, classId, date, selections) {
        const classStudents = Students.getByClass(state, classId).map(function(s) { return s.id; });

        // حذف السجلات القديمة لهذا اليوم
        state.records = state.records.filter(function(r) {
            return !(r.date === date && classStudents.indexOf(r.student_id) !== -1);
        });

        let maxId = state.records.reduce(function(m, r) { return Math.max(m, r.id || 0); }, 0);

        for (const entry of Object.entries(selections)) {
            const sid = parseInt(entry[0]);
            if (classStudents.indexOf(sid) === -1) continue;

            const data = entry[1];
            
            // استخراج الحالات
            let status = data.status || "present";
            let escapes = data.escapes || [];
            let lates = data.lates || [];

            // حفظ السجل
            maxId++;
            state.records.push({
                id: maxId,
                student_id: sid,
                date: date,
                status: status,
                escapes: escapes,
                lates: lates
            });
        }
        return true;
    },

    deleteRecord: function(state, recordId) {
        state.records = state.records.filter(function(r) { return r.id !== recordId; });
        return true;
    },

    countAbsent: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.ABSENT;
        }).length;
    },

    countExcused: function(state, studentId) {
        return state.records.filter(function(r) {
            return r.student_id === studentId && r.status === STATUS.EXCUSED;
        }).length;
    },

    countEscapeHours: function(state, studentId) {
        let total = 0;
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.escapes) total += r.escapes.length;
        });
        return total;
    },

    countLateHours: function(state, studentId) {
        let total = 0;
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.lates) total += r.lates.length;
        });
        return total;
    },

    countLateMinutes: function(state, studentId) {
        let total = 0;
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.lates) {
                r.lates.forEach(function(l) { total += (l.minutes || 0); });
            }
        });
        return total;
    },

    countForAlerts: function(state, studentId) {
        return Attendance.countAbsent(state, studentId);
    },

    countForWarnings: function(state, studentId) {
        return Attendance.countAbsent(state, studentId);
    },

    getAbsentDates: function(state, studentId) {
        return state.records
            .filter(function(r) { return r.student_id === studentId && r.status === STATUS.ABSENT; })
            .map(function(r) { return r.date; })
            .sort();
    },

    getExcusedDates: function(state, studentId) {
        return state.records
            .filter(function(r) { return r.student_id === studentId && r.status === STATUS.EXCUSED; })
            .map(function(r) { return r.date; })
            .sort();
    },

    getEscapeDetails: function(state, studentId) {
        let res = [];
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.escapes) {
                r.escapes.forEach(function(e) { res.push({date: r.date, period: e.period}); });
            }
        });
        return res;
    },

    getLateDetails: function(state, studentId) {
        let res = [];
        state.records.forEach(function(r) {
            if (r.student_id === studentId && r.lates) {
                r.lates.forEach(function(l) { res.push({date: r.date, period: l.period, minutes: l.minutes}); });
            }
        });
        return res;
    }
};
