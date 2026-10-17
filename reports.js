/* ==========================================================================
   reports.js - التقارير
   ========================================================================== */

const Reports = {

    generate: function(state, classId, startDate, endDate, mode) {
        const students = Students.getByClass(state, classId);

        return students.map(function(s) {
            const recs = state.records.filter(function(r) {
                return r.student_id === s.id && r.date >= startDate && r.date <= endDate;
            });

            const aD = recs.filter(function(r) { return r.status === STATUS.ABSENT; });
            const eD = recs.filter(function(r) { return r.status === STATUS.EXCUSED; });

            // حساب الهروب والتأخير
            let escapeHours = 0, lateHours = 0, lateMinutes = 0;
            recs.forEach(function(r) {
                if (r.escapes && Array.isArray(r.escapes)) escapeHours += r.escapes.length;
                if (r.lates && Array.isArray(r.lates)) {
                    lateHours += r.lates.length;
                    r.lates.forEach(function(l) { lateMinutes += (l.minutes || 0); });
                }
            });

            let displayDates = [];
            let sortKey = 0;

            if (mode === "all") {
                displayDates = recs.map(function(r) {
                    let label = "";
                    if (r.status === STATUS.EXCUSED) label = " (عذر)";
                    if (r.escapes && r.escapes.length > 0) {
                        label += " [هروب: " + r.escapes.map(function(e) { return "ح" + e.period; }).join(",") + "]";
                    }
                    if (r.lates && r.lates.length > 0) {
                        label += " [تأخير: " + r.lates.map(function(l) { return "ح" + l.period + "/" + l.minutes + "د"; }).join(",") + "]";
                    }
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
                displayDates = [];
                recs.forEach(function(r) {
                    if (r.escapes && r.escapes.length > 0) {
                        r.escapes.forEach(function(e) {
                            displayDates.push(r.date + " (ح" + e.period + ")");
                        });
                    }
                });
                displayDates.sort();
                sortKey = escapeHours;
            } else if (mode === "late") {
                displayDates = [];
                recs.forEach(function(r) {
                    if (r.lates && r.lates.length > 0) {
                        r.lates.forEach(function(l) {
                            displayDates.push(r.date + " (ح" + l.period + " - " + l.minutes + "د)");
                        });
                    }
                });
                displayDates.sort();
                sortKey = lateHours;
            }

            const alertTotal = aD.length;  // فقط الغياب بدون عذر

            return {
                id: s.id,
                classId: s.classId,
                nameAr: s.nameAr,
                number: s.number,
                absent: aD.length,
                excused: eD.length,
                escapeHours: escapeHours,
                lateHours: lateHours,
                lateMinutes: lateMinutes,
                total: recs.length,
                alertTotal: alertTotal,
                displayDates: displayDates,
                sortKey: sortKey,
                color: getStatusColor(alertTotal),
                status: getStatusText(alertTotal)
            };
        }).sort(function(a, b) { return b.sortKey - a.sortKey; });
    },

    exportCSV: function(rows, className, startDate, endDate) {
        let csv = "\uFEFF";
        csv += "الرقم,اسم الطالب,رقم الطالب,غياب,بعذر,حصص هروب,حصص تأخير,دقائق التأخير,الحالة\n";

        rows.forEach(function(r) {
            csv += '"' + r.id + '","' + r.nameAr + '","' + r.number + '",' +
                   r.absent + ',' + r.excused + ',' + r.escapeHours + ',' + r.lateHours + ',' + r.lateMinutes + ',' +
                   '"' + r.status + '"\n';
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "تقرير_" + className + "_" + startDate + "_" + endDate + ".csv";
        a.click();
    }
};
