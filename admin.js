/* ==========================================================================
   admin.js - إدارة المستخدمين (للمدير فقط)
   ========================================================================== */

const Admin = {
    // إضافة مستخدم جديد
    addUser: function(state, username, password, name, role, classId) {
        if (state.users[username]) {
            return { ok: false, msg: "اسم المستخدم موجود مسبقاً" };
        }
        if (!username || !password || !name) {
            return { ok: false, msg: "جميع الحقول مطلوبة" };
        }

        state.users[username] = {
            password: password,
            name: name,
            role: role,
            classId: role === "admin" ? null : classId
        };
        return { ok: true, msg: "تمت إضافة المستخدم" };
    },

    // حذف مستخدم
    removeUser: function(state, username) {
        if (username === "admin") {
            return { ok: false, msg: "لا يمكن حذف حساب المدير الرئيسي" };
        }
        delete state.users[username];
        return { ok: true, msg: "تم حذف المستخدم" };
    },

    // تعديل كلمة المرور
    changePassword: function(state, username, newPassword) {
        if (!state.users[username]) {
            return { ok: false, msg: "المستخدم غير موجود" };
        }
        state.users[username].password = newPassword;
        return { ok: true, msg: "تم تغيير كلمة المرور" };
    },

    // تعديل بيانات مستخدم
    updateUser: function(state, username, name, role, classId) {
        if (!state.users[username]) {
            return { ok: false, msg: "المستخدم غير موجود" };
        }
        state.users[username].name = name;
        state.users[username].role = role;
        state.users[username].classId = role === "admin" ? null : classId;
        return { ok: true, msg: "تم تحديث البيانات" };
    }
};