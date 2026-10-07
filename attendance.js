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
            maxId++;
            state.records.push({
                id: maxId,
                student_id: sid,
                date: date,
                status: entry[1],
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

    // عدد الغياب بدون عذر لطالب
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

    // تواريخ الغياب بدون عذر
    getAbsentDates: function(state, studentId) {
        return state.records
            .filter(function(r) {
                return r.student_id === studentId && r.status === STATUS.ABSENT;
            })
            .map(function(r) { return r.date; })
            .sort();
    }
};