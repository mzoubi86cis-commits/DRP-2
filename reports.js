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

            const aD = recs.filter(function(r) { return r.status === STATUS.ABSENT; });
            const eD = recs.filter(function(r) { return r.status === STATUS.EXCUSED; });
            const escD = recs.filter(function(r) { return r.status === STATUS.ESCAPE; });
            const lateD = recs.filter(function(r) { return r.status === STATUS.LATE; });

            let displayDates = [];
            let sortKey = 0;

            if (mode === "all") {
                displayDates = recs.map(function(r) {
                    let label = "";
                    if (r.status === STATUS.EXCUSED) label = " (عذر)";
                    else if (r.status === STATUS.ESCAPE) label = " (هروب ح" + (r.period || "?") + ")";
                    else if (r.status === STATUS.LATE) label = " (تأخير " + (r.minutes || "?") + "د ح" + (r.period || "?") + ")";
                    return r.date + label;
                }).sort();
                sortKey = recs.length;
            } else if (mode === "absent") {
                displayDates = aD.map(function(r) { return r.date; }).sort();
                sortKey = aD.length;
            } else if (mode === "excused") {
                displayDates = eD.map(function(r) { return r.date; }).sort();
                sortKey = eD.length;
            } else if (mode === "escape") {
                displayDates = escD.map(function(r) {
                    return r.date + " (ح" + (r.period || "?") + ")";
                }).sort();
                sortKey = escD.length;
            } else if (mode === "late") {
                displayDates = lateD.map(function(r) {
                    return r.date + " (" + (r.minutes || "?") + "د ح" + (r.period || "?") + ")";
                }).sort();
                sortKey = lateD.length;
            }

            // حساب المجموع للتنبيهات
            let alertTotal = aD.length;
            if (COUNT_IN_ALERTS.ESCAPE) alertTotal += escD.length;
            if (COUNT_IN_ALERTS.LATE)   alertTotal += lateD.length;

            return {
                id: s.id,
                classId: s.classId,
                nameAr: s.nameAr,
                number: s.number,
                absent: aD.length,
                excused: eD.length,
                escape: escD.length,
                late: lateD.length,
                total: recs.length,
                alertTotal: alertTotal,
                displayDates: displayDates,
                sortKey: sortKey,
                color: getStatusColor(alertTotal),
                status: getStatusText(alertTotal)
            };
        }).sort(function(a, b) { return b.sortKey - a.sortKey; });
    },

    // تصدير CSV
    exportCSV: function(rows, className, startDate, endDate) {
        let csv = "\uFEFF";
        csv += "الرقم,اسم الطالب,رقم الطالب,غائب,بعذر,هروب,تأخير,الإجمالي,الحالة,تواريخ الغياب\n";

        rows.forEach(function(r) {
            const dStr = r.displayDates.join(" | ");
            csv += '"' + r.id + '","' + r.nameAr + '","' + r.number + '",' +
                   r.absent + ',' + r.excused + ',' + r.escape + ',' + r.late + ',' +
                   r.total + ',' + '"' + r.status + '","' + dStr + '"\n';
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "تقرير_" + className + "_" + startDate + "_" + endDate + ".csv";
        a.click();
    }
};
