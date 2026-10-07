/* ==========================================================================
   students.js - إدارة الطلاب (إضافة/حذف/استيراد Excel)
   ========================================================================== */

const Students = {
    // الحصول على طلاب صف معين
    getByClass: function(state, classId) {
        return state.students.filter(function(s) { return s.classId === classId; });
    },

    // إضافة طالب جديد
    add: function(state, classId, nameAr, nameEn, number) {
        // التحقق من عدم التكرار
        const exists = state.students.find(function(s) {
            return s.number === number && s.classId === classId;
        });
        if (exists) return { ok: false, msg: "رقم الطالب موجود مسبقاً في هذا الصف" };

        // توليد ID جديد
        const maxId = state.students.reduce(function(m, s) {
            return Math.max(m, s.id || 0);
        }, 0);

        state.students.push({
            id: maxId + 1,
            classId: classId,
            nameAr: nameAr.trim(),
            nameEn: nameEn.trim(),
            number: number.trim()
        });

        return { ok: true, msg: "تمت إضافة الطالب بنجاح" };
    },

    // حذف طالب
    remove: function(state, studentId) {
        state.students = state.students.filter(function(s) { return s.id !== studentId; });
        // حذف سجلاته أيضاً
        state.records = state.records.filter(function(r) { return r.student_id !== studentId; });
        return { ok: true, msg: "تم حذف الطالب وسجلاته" };
    },

    // تعديل بيانات طالب
    update: function(state, studentId, nameAr, nameEn, number) {
        const s = state.students.find(function(x) { return x.id === studentId; });
        if (!s) return { ok: false, msg: "الطالب غير موجود" };

        // تحقق من عدم تكرار الرقم
        const exists = state.students.find(function(x) {
            return x.id !== studentId && x.number === number && x.classId === s.classId;
        });
        if (exists) return { ok: false, msg: "رقم الطالب مستخدم مسبقاً" };

        s.nameAr = nameAr.trim();
        s.nameEn = nameEn.trim();
        s.number = number.trim();
        return { ok: true, msg: "تم تحديث البيانات" };
    },

    // استيراد من Excel/CSV
    importFromFile: function(state, classId, file, callback) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                let added = 0, skipped = 0;
                const errors = [];

                // تخطي الصف الأول (العناوين) إذا كان يحتوي على كلمات مفتاحية
                let startIdx = 0;
                if (rows[0] && (
                    String(rows[0][0] || "").includes("اسم") ||
                    String(rows[0][0] || "").includes("الطالب") ||
                    String(rows[0][0] || "").includes("name")
                )) {
                    startIdx = 1;
                }

                for (let i = startIdx; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length < 3) continue;

                    const nameAr = String(row[0] || "").trim();
                    const nameEn = String(row[1] || "").trim();
                    const number = String(row[2] || "").trim();

                    if (!nameAr || !number) { skipped++; continue; }

                    const result = Students.add(state, classId, nameAr, nameEn, number);
                    if (result.ok) added++;
                    else { skipped++; errors.push("صف " + (i + 1) + ": " + result.msg); }
                }

                callback({
                    ok: true,
                    added: added,
                    skipped: skipped,
                    errors: errors
                });
            } catch(err) {
                callback({ ok: false, msg: "فشل قراءة الملف: " + err.message });
            }
        };
        reader.readAsArrayBuffer(file);
    },

    // تنزيل قالب Excel
    downloadTemplate: function() {
        const wsData = [
            ["اسم الطالب", "الاسم بالإنجليزية", "رقم الطالب"],
            ["احمد زياد محمود رشيدات", "Ahmad Zyad Rshedat", "UD90702"],
            ["ايوب رائد محمد السخاينه", "Ayoub Ra'ed Mohammad Skhayneh", "UD90704"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws["!cols"] = [{ wch: 30 }, { wch: 35 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
        XLSX.writeFile(wb, "قالب_الطلاب.xlsx");
    }
};