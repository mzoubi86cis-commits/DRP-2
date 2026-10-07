/* ==========================================================================
   reports.js - التقارير والإنذارات
   ========================================================================== */

const Reports = {
    // توليد تقرير لصف معين
    generate: function(state, classId, startDate, endDate, mode) {
        const students = Students.getByClass(state, classId);

        return students.map(function(s) {
            const recs = state.records.filter(function(r) {
                return r.student_id === s.id && r.date >= startDate && r.date <= endDate;
            });
            const aD = recs.filter(function(r) { return r.status === STATUS.ABSENT; })
                           .map(function(r) { return r.date; }).sort();
            const eD = recs.filter(function(r) { return r.status === STATUS.EXCUSED; })
                           .map(function(r) { return r.date; }).sort();

            let displayDates = [], sortKey = 0;
            if (mode === "all") {
                displayDates = recs.map(function(r) {
                    return r.date + (r.status === STATUS.EXCUSED ? " (عذر)" : "");
                }).sort();
                sortKey = recs.length;
            } else if (mode === "absent") {
                displayDates = aD;
                sortKey = aD.length;
            } else if (mode === "excused") {
                displayDates = eD;
                sortKey = eD.length;
            }

            return {
                id: s.id,
                classId: s.classId,
                nameAr: s.nameAr,
                number: s.number,
                absent: aD.length,
                excused: eD.length,
                total: recs.length,
                displayDates: displayDates,
                sortKey: sortKey,
                color: getStatusColor(aD.length),
                status: getStatusText(aD.length)
            };
        }).sort(function(a, b) { return b.sortKey - a.sortKey; });
    },

    // توليد تقرير عام (كل الصفوف) - للمدير
    generateAll: function(state, startDate, endDate, mode) {
        return CLASSES.map(function(c) {
            return {
                classInfo: c,
                rows: Reports.generate(state, c.id, startDate, endDate, mode)
            };
        });
    },

    // تصدير CSV
    exportCSV: function(rows, className, startDate, endDate) {
        let csv = "\uFEFF";
        csv += "الرقم,اسم الطالب,رقم الطالب,غائب,بعذر,الإجمالي,الحالة,تواريخ الغياب\n";

        rows.forEach(function(r) {
            const dStr = r.displayDates.join(" | ");
            csv += '"' + r.id + '","' + r.nameAr + '","' + r.number + '",' +
                   r.absent + ',' + r.excused + ',' + r.total + ',' +
                   '"' + r.status + '","' + dStr + '"\n';
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "تقرير_" + className + "_" + startDate + "_" + endDate + ".csv";
        a.click();
    }
};