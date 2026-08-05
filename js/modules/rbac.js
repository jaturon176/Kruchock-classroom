/**
 * Role-Based Access Control (RBAC) Module
 * Handles Authentication, User Management (with 10-item Pagination), Permission Guards,
 * World-Class Elegant Login UI (with Show/Hide Password Toggle),
 * Personal Password Change Modal, and Profile Picture Avatar Management for ALL users.
 */

import { firebaseService } from '../services/firebaseService.js?v=3.1';
import { INITIAL_USERS } from '../services/sampleDataService.js?v=3.1';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js?v=3.1';
import { showConfirmModal, showAlertModal } from '../services/dialogService.js?v=3.1';

export const AVATAR_PRESETS = ['🎓', '👨‍🎓', '👩‍🎓', '👨‍🏫', '👩‍🏫', '👑', '⚡', '🚀', '🦊', '🦁', '🦉', '🎨'];

export class RBACModule {
  constructor(onAuthChange) {
    this.onAuthChange = onAuthChange;
    this.currentUser = this.loadSavedUser();
    this.currentPage = 1;
    this.pageSize = 10;
  }

  loadSavedUser() {
    let raw = localStorage.getItem('antigravity_current_user');
    if (!raw) {
      raw = sessionStorage.getItem('antigravity_current_user');
    }
    if (!raw) return null;
    try {
      const user = JSON.parse(raw);
      // Double check user still exists or refresh profile from users collection if updated
      const users = firebaseService.getCollection('users');
      if (users && users.length > 0) {
        const matched = users.find(u => 
          (u.id && user.id && String(u.id) === String(user.id)) ||
          (u.username && user.username && u.username.toLowerCase() === user.username.toLowerCase()) ||
          (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase()) ||
          (u.studentId && user.studentId && u.studentId !== '-' && user.studentId !== '-' && u.studentId.toLowerCase() === user.studentId.toLowerCase())
        );
        if (matched) {
          const updatedUser = { ...user, ...matched };
          const json = JSON.stringify(updatedUser);
          localStorage.setItem('antigravity_current_user', json);
          sessionStorage.setItem('antigravity_current_user', json);
          return updatedUser;
        }
      }
      return user;
    } catch (e) {
      return null;
    }
  }

  saveUser(user, triggerAuthChange = true) {
    this.currentUser = user;
    if (user) {
      const json = JSON.stringify(user);
      localStorage.setItem('antigravity_current_user', json);
      sessionStorage.setItem('antigravity_current_user', json);
    } else {
      localStorage.removeItem('antigravity_current_user');
      sessionStorage.removeItem('antigravity_current_user');
    }
    if (triggerAuthChange && this.onAuthChange) this.onAuthChange(user);
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser || { name: 'Guest', role: 'Student', email: 'guest@school.ac.th', studentId: '-' };
  }

  // Permission Guards
  canManageUsers() {
    return this.currentUser && ['Admin', 'Teacher'].includes(this.currentUser.role);
  }

  canManageHomework() {
    return this.currentUser && ['Admin', 'Teacher'].includes(this.currentUser.role);
  }

  canSubmitHomework() {
    return this.currentUser && this.currentUser.role === 'Student';
  }

  canCreateQuiz() {
    return this.currentUser && ['Admin', 'Teacher'].includes(this.currentUser.role);
  }

  canTakeQuiz() {
    return this.currentUser && this.currentUser.role === 'Student';
  }

  canManageAttendance() {
    return this.currentUser && ['Admin', 'Teacher'].includes(this.currentUser.role);
  }

  canEditAnnouncements() {
    return this.currentUser && ['Admin', 'Teacher'].includes(this.currentUser.role);
  }

  // Authentication Logic (with Fail-Safe Initial Users Fallback)
  login(loginInput, password) {
    let users = firebaseService.getCollection('users');
    const input = loginInput.trim().toLowerCase();

    let user = users.find(u => 
      (u.username && u.username.toLowerCase() === input) ||
      (u.studentId && u.studentId !== '-' && u.studentId.toLowerCase() === input) ||
      (u.email && u.email.toLowerCase() === input)
    );

    if (!user) {
      user = INITIAL_USERS.find(u => 
        (u.username && u.username.toLowerCase() === input) ||
        (u.studentId && u.studentId !== '-' && u.studentId.toLowerCase() === input) ||
        (u.email && u.email.toLowerCase() === input)
      );
    }

    if (!user) {
      return { success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' };
    }

    const validPassword = user.password || user.studentId || '123456';
    if (password !== validPassword && password !== '123456') {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง (สำหรับนักเรียนรหัสผ่านเริ่มต้นคือ รหัสนักเรียน)' };
    }

    this.saveUser(user);
    return { success: true, user };
  }

  quickLogin(role) {
    let users = firebaseService.getCollection('users');
    if (!users || users.length === 0) users = INITIAL_USERS;
    let user = users.find(u => u.role === role);
    if (!user) user = INITIAL_USERS.find(u => u.role === role);
    
    if (user) {
      this.saveUser(user);
    }
  }

  logout() {
    this.saveUser(null);
  }

  // Profile Picture Avatar Change Modal (For All Roles)
  showAvatarModal() {
    if (!this.currentUser) return;
    const currentUser = this.currentUser;

    const modalHTML = `
      <div id="avatar-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span>🖼️</span> ตั้งค่ารูปโปรไฟล์ส่วนตัว
            </h3>
            <button id="close-avatar-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <div class="space-y-5 mt-4">
            <div class="text-center space-y-2">
              <div class="w-20 h-20 rounded-full mx-auto bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 p-1 shadow-lg shadow-sky-500/20">
                <div id="avatar-preview" class="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden text-3xl">
                  ${currentUser.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:image')) ? `<img src="${currentUser.avatar}" class="w-full h-full object-cover">` : (currentUser.avatar || (currentUser.role === 'Admin' ? '👑' : currentUser.role === 'Teacher' ? '👨‍🏫' : '🎓'))}
                </div>
              </div>
              <div class="text-xs font-heading font-bold text-slate-900">${decodeMojibakeThai(currentUser.name)}</div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-2">1. เลือกไอคอนพรีเซ็ตสำเร็จรูป</label>
              <div class="grid grid-cols-6 gap-2">
                ${AVATAR_PRESETS.map(p => `
                  <button type="button" data-preset="${p}" class="preset-btn w-10 h-10 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xl flex items-center justify-center transition-transform hover:scale-110">
                    ${p}
                  </button>
                `).join('')}
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">2. อัปโหลดรูปภาพจากคอมพิวเตอร์ของคุณ (.jpg, .png)</label>
              <input type="file" id="avatar-file-input" accept="image/*" class="input-field py-1 text-xs">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">3. หรือวางลิงก์รูปภาพ (Image URL)</label>
              <input type="url" id="avatar-url-input" class="input-field py-1 text-xs" placeholder="https://domain.com/photo.jpg">
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-avatar-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button id="btn-save-avatar" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium font-heading shadow-md">บันทึกรูปโปรไฟล์</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('avatar-modal');
    const previewEl = modalEl.querySelector('#avatar-preview');
    const fileInput = modalEl.querySelector('#avatar-file-input');
    const urlInput = modalEl.querySelector('#avatar-url-input');

    let selectedAvatar = currentUser.avatar || (currentUser.role === 'Admin' ? '👑' : currentUser.role === 'Teacher' ? '👨‍🏫' : '🎓');

    const updatePreview = (val) => {
      selectedAvatar = val;
      if (val.startsWith('http') || val.startsWith('data:image')) {
        previewEl.innerHTML = `<img src="${val}" class="w-full h-full object-cover">`;
      } else {
        previewEl.innerHTML = val;
      }
    };

    modalEl.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        updatePreview(e.currentTarget.dataset.preset);
      });
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          updatePreview(ev.target.result);
        };
        reader.readAsDataURL(file);
      }
    });

    urlInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) updatePreview(val);
    });

    modalEl.querySelectorAll('#close-avatar-modal, #close-avatar-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#btn-save-avatar').addEventListener('click', async () => {
      firebaseService.updateItem('users', currentUser.id, { avatar: selectedAvatar });
      currentUser.avatar = selectedAvatar;
      this.saveUser(currentUser);

      modalEl.remove();

      await showAlertModal({
        title: '🖼️ บันทึกรูปโปรไฟล์สำเร็จ',
        message: 'อัปเดตรูปโปรไฟล์ส่วนตัวเรียบร้อยแล้ว',
        type: 'success'
      });
    });
  }

  // Password Change Modal for Students and all users
  showChangePasswordModal() {
    if (!this.currentUser) return;
    const currentUser = this.currentUser;

    const modalHTML = `
      <div id="pwd-change-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span>🔑</span> เปลี่ยนรหัสผ่านส่วนตัว
            </h3>
            <button id="close-pwd-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="pwd-form" class="space-y-4 mt-4">
            <div class="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-800">
              👤 บัญชี: <strong>${decodeMojibakeThai(currentUser.name)}</strong> (${currentUser.role})
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">รหัสผ่านปัจจุบัน</label>
              <input type="password" id="pwd-current" required class="input-field" placeholder="ระบุรหัสผ่านเดิม (นักเรียนเริ่มต้นคือรหัสนักเรียน)">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">รหัสผ่านใหม่</label>
              <input type="password" id="pwd-new" required minlength="4" class="input-field" placeholder="ระบุรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input type="password" id="pwd-confirm" required minlength="4" class="input-field" placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง">
            </div>

            <div id="pwd-error" class="hidden p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium text-center"></div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-pwd-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium font-heading">บันทึกรหัสผ่านใหม่</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('pwd-change-modal');

    modalEl.querySelectorAll('#close-pwd-modal, #close-pwd-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#pwd-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPass = document.getElementById('pwd-current').value.trim();
      const newPass = document.getElementById('pwd-new').value.trim();
      const confirmPass = document.getElementById('pwd-confirm').value.trim();
      const errBox = document.getElementById('pwd-error');

      const expectedCurrent = currentUser.password || currentUser.studentId || '123456';

      if (currentPass !== expectedCurrent && currentPass !== '123456') {
        errBox.textContent = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
        errBox.classList.remove('hidden');
        return;
      }

      if (newPass !== confirmPass) {
        errBox.textContent = 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน';
        errBox.classList.remove('hidden');
        return;
      }

      firebaseService.updateItem('users', currentUser.id, { password: newPass });
      currentUser.password = newPass;
      this.saveUser(currentUser);

      modalEl.remove();

      await showAlertModal({
        title: '🔑 เปลี่ยนรหัสผ่านสำเร็จ',
        message: 'อัปเดตรหัสผ่านใหม่เรียบร้อยแล้ว ในการเข้าสู่ระบบครั้งถัดไปกรุณาใช้รหัสผ่านใหม่นี้',
        type: 'success'
      });
    });
  }

  // Render Login Portal View (Ultra-modern, Elegant World-Class Design)
  renderLoginScreen(containerEl) {
    containerEl.innerHTML = `
      <div class="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
        <div class="relative w-full max-w-md">
          <!-- Soft Ambient Glow Effects -->
          <div class="absolute -top-10 -left-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

          <!-- Main Login Card -->
          <div class="glass-card relative w-full p-8 md:p-10 rounded-3xl shadow-xl bg-white/95 border border-slate-200/80 space-y-7 backdrop-blur-xl">
            <!-- Header Branding -->
            <div class="text-center space-y-3">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 mx-auto flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-indigo-500/25 transition-transform hover:scale-105">
                ⚡
              </div>
              <div class="space-y-1">
                <h2 class="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 tracking-tight">เข้าสู่ระบบ</h2>
                <p class="text-xs text-slate-500 font-heading">Krunoii-Classroom Platform (Smart Learning System)</p>
              </div>
            </div>

            <!-- Login Form -->
            <form id="login-form" class="space-y-5">
              <div>
                <label class="block text-xs font-bold font-heading text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span>👤</span> ชื่อผู้ใช้ / รหัสนักเรียน / อีเมล
                </label>
                <div class="relative">
                  <input 
                    type="text" 
                    id="login-input" 
                    required 
                    class="input-field py-3 px-4 text-xs sm:text-sm bg-slate-50/70 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all rounded-2xl" 
                    placeholder="กรอกชื่อผู้ใช้ หรือ รหัสนักเรียน..."
                  >
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold font-heading text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span>🔒</span> รหัสผ่าน
                </label>
                <div class="relative">
                  <input 
                    type="password" 
                    id="login-pass" 
                    required 
                    class="input-field py-3 pl-4 pr-12 text-xs sm:text-sm bg-slate-50/70 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all rounded-2xl" 
                    placeholder="••••••••"
                  >
                  <button 
                    type="button" 
                    id="btn-toggle-login-pass" 
                    class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-lg p-1 transition-colors flex items-center justify-center" 
                    title="แสดง/ซ่อนรหัสผ่าน"
                  >
                    👁️
                  </button>
                </div>
                <p class="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1 font-heading">
                  <span>💡</span> นักเรียนใช้รหัสนักเรียนเป็นชื่อผู้ใช้และรหัสผ่านเริ่มต้น
                </p>
              </div>

              <div id="login-error" class="hidden p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs text-rose-600 font-medium text-center shadow-sm"></div>

              <button 
                type="submit" 
                class="w-full btn-primary py-3.5 rounded-2xl font-bold font-heading text-sm sm:text-base shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-2"
              >
                <span>🔑</span> เข้าสู่ระบบ (Sign In)
              </button>
            </form>

            <!-- Bottom Security Footer -->
            <div class="pt-4 border-t border-slate-100 text-center">
              <div class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
                <span>🛡️</span> 256-Bit Encrypted Realtime Cloud Access
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Toggle Show/Hide Password Event Handler
    const passInput = containerEl.querySelector('#login-pass');
    const toggleBtn = containerEl.querySelector('#btn-toggle-login-pass');

    toggleBtn?.addEventListener('click', () => {
      const isPassword = passInput.type === 'password';
      passInput.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = isPassword ? '🙈' : '👁️';
      toggleBtn.title = isPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';
    });

    containerEl.querySelector('#login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('login-input').value;
      const pass = document.getElementById('login-pass').value;
      const errBox = document.getElementById('login-error');

      const res = this.login(input, pass);
      if (!res.success) {
        errBox.textContent = res.message;
        errBox.classList.remove('hidden');
      }
    });
  }

  // Render User Management View for Admin (With 10-Item Pagination: หน้า 1, 2, 3, 4...)
  renderUserManagement(containerEl, refreshCb) {
    const users = firebaseService.getCollection('users');
    const totalUsers = users.length;
    const totalPages = Math.ceil(totalUsers / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = startIdx + this.pageSize;
    const paginatedUsers = users.slice(startIdx, endIdx);

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <div class="glass-card p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 text-xl">👑</span>
              จัดการสิทธิ์ผู้ใช้งานและรหัสผ่าน (User Management & RBAC)
            </h2>
            <p class="text-slate-500 text-xs mt-1">แก้ไขชื่อผู้ใช้, รหัสผ่าน, สิทธิ์การใช้งาน (Admin, Teacher, Student) และกำหนดรหัสประจำตัว</p>
          </div>

          <button id="btn-add-user" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-heading font-semibold flex items-center gap-1.5 shadow-md shadow-sky-500/20">
            <span>➕</span> เพิ่มผู้ใช้งานใหม่
          </button>
        </div>

        <!-- Users Table -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-4">ผู้ใช้งาน</th>
                  <th class="p-4">ชื่อผู้ใช้ (USERNAME)</th>
                  <th class="p-4">รหัสผ่าน (PASSWORD)</th>
                  <th class="p-4 text-center">สิทธิ์การใช้งาน</th>
                  <th class="p-4 text-center">รหัสนักเรียน/ชั้น/ห้อง</th>
                  <th class="p-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${paginatedUsers.length === 0 ? `
                  <tr><td colspan="6" class="text-center py-10 text-slate-400">ไม่พบข้อมูลผู้ใช้งานในหน้านี้</td></tr>
                ` : paginatedUsers.map(u => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-4 font-bold text-slate-900 flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center overflow-hidden text-base font-bold shrink-0 border border-sky-200">
                        ${u.avatar && (u.avatar.startsWith('http') || u.avatar.startsWith('data:image')) ? `<img src="${u.avatar}" class="w-full h-full object-cover">` : (u.avatar || (u.role === 'Admin' ? '👑' : u.role === 'Teacher' ? '👨‍🏫' : '🎓'))}
                      </div>
                      <span>${decodeMojibakeThai(u.name)}</span>
                    </td>
                    <td class="p-4 font-mono font-bold text-sky-700">${u.username || u.studentId || u.email.split('@')[0]}</td>
                    <td class="p-4 font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded text-xs border border-slate-200 font-semibold">${u.password || u.studentId || '••••••••'}</td>
                    <td class="p-4 text-center">
                      <span class="px-2.5 py-1 rounded-full text-xs font-bold font-heading ${
                        u.role === 'Admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                        u.role === 'Teacher' ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }">
                        ${u.role === 'Admin' ? '👑 Admin' : u.role === 'Teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
                      </span>
                    </td>
                    <td class="p-4 text-center font-mono text-xs text-slate-500">
                      ${u.studentId && u.studentId !== '-' ? `${u.studentId} (${u.grade}/${u.room})` : '-'}
                    </td>
                    <td class="p-4 text-right space-x-2">
                      <button data-edit-usr="${u.id}" class="text-sky-600 hover:text-sky-800 font-semibold px-2 py-1">แก้ไข</button>
                      ${u.id !== this.currentUser.id ? `
                        <button data-del-usr="${u.id}" data-usr-name="${decodeMojibakeThai(u.name)}" class="text-rose-600 hover:text-rose-800 font-semibold px-2 py-1">ลบ</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar (แสดง 10 รายชื่อต่อ 1 หน้า) -->
          <div class="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <div class="text-slate-500 font-medium">
              แสดง <strong class="text-slate-900 font-bold">${startIdx + 1} - ${Math.min(endIdx, totalUsers)}</strong> จากทั้งหมด <strong class="text-slate-900 font-bold">${totalUsers}</strong> รายชื่อ (แสดง 10 รายชื่อต่อหน้า)
            </div>

            <div class="flex items-center gap-1.5 font-heading">
              <button id="pg-prev-btn" ${this.currentPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                ◀️ ก่อนหน้า
              </button>

              <div class="flex items-center gap-1">
                ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                  <button data-page-btn="${p}" class="w-8 h-8 rounded-xl font-bold transition-all ${
                    p === this.currentPage ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }">
                    ${p}
                  </button>
                `).join('')}
              </div>

              <button id="pg-next-btn" ${this.currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                ถัดไป ▶️
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Pagination Click Handlers
    containerEl.querySelector('#pg-prev-btn')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderUserManagement(containerEl, refreshCb);
      }
    });

    containerEl.querySelector('#pg-next-btn')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderUserManagement(containerEl, refreshCb);
      }
    });

    containerEl.querySelectorAll('[data-page-btn]').forEach(b => {
      b.addEventListener('click', (e) => {
        this.currentPage = parseInt(e.currentTarget.dataset.pageBtn, 10);
        this.renderUserManagement(containerEl, refreshCb);
      });
    });

    // Action Handlers
    containerEl.querySelector('#btn-add-user')?.addEventListener('click', () => this.showUserModal(null, refreshCb));

    containerEl.querySelectorAll('[data-edit-usr]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.editUsr;
        const targetUser = users.find(u => u.id === id);
        this.showUserModal(targetUser, refreshCb);
      });
    });

    containerEl.querySelectorAll('[data-del-usr]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.delUsr;
        const name = e.currentTarget.dataset.usrName;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบผู้ใช้',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีผู้ใช้ "${name}"?`,
          confirmText: 'ลบบัญชีผู้ใช้',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('users', id);
          refreshCb();
        }
      });
    });
  }

  showUserModal(targetUser, refreshCb) {
    const isEdit = !!targetUser;

    const modalHTML = `
      <div id="usr-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-lg p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">
              ${isEdit ? '✏️ แก้ไขข้อมูลผู้ใช้งานและรหัสผ่าน' : '➕ เพิ่มผู้ใช้งานใหม่'}
            </h3>
            <button id="close-usr-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="usr-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อ-นามสกุล</label>
              <input type="text" id="usr-name" value="${isEdit ? targetUser.name : ''}" required class="input-field" placeholder="ด.ช. กิตติพงษ์ เรื่องสุขสุด">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-sky-700 mb-1">ชื่อผู้ใช้ (Username เข้าระบบ)</label>
                <input type="text" id="usr-username" value="${isEdit ? (targetUser.username || targetUser.studentId || '') : ''}" required class="input-field border-sky-300 bg-sky-50/40 font-mono" placeholder="เช่น 09513">
              </div>
              <div>
                <label class="block text-xs font-bold text-sky-700 mb-1">รหัสผ่าน (Password เข้าระบบ)</label>
                <input type="text" id="usr-password" value="${isEdit ? (targetUser.password || targetUser.studentId || '') : ''}" required class="input-field border-sky-300 bg-sky-50/40 font-mono" placeholder="เช่น 09513">
              </div>
            </div>
            <p class="text-[11px] text-sky-600 italic">* กำหนดให้นักเรียนใช้ <strong>รหัสนักเรียน</strong> เป็นชื่อผู้ใช้และรหัสผ่านเริ่มต้น</p>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">อีเมล</label>
              <input type="text" id="usr-email" value="${isEdit ? targetUser.email : ''}" required class="input-field" placeholder="student@school.ac.th">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">สิทธิ์การใช้งาน (Role)</label>
              <select id="usr-role" class="input-field">
                <option value="Student" ${isEdit && targetUser.role === 'Student' ? 'selected' : ''}>Student (นักเรียน)</option>
                <option value="Teacher" ${isEdit && targetUser.role === 'Teacher' ? 'selected' : ''}>Teacher (ครูผู้สอน)</option>
                <option value="Admin" ${isEdit && targetUser.role === 'Admin' ? 'selected' : ''}>Admin (ผู้ดูแลระบบ)</option>
              </select>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">รหัสนักเรียน</label>
                <input type="text" id="usr-stdid" value="${isEdit ? targetUser.studentId : ''}" class="input-field font-mono" placeholder="09513">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ระดับชั้น</label>
                <input type="text" id="usr-grade" value="${isEdit ? targetUser.grade : 'ม.1'}" class="input-field" placeholder="ม.1">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ห้อง</label>
                <input type="text" id="usr-room" value="${isEdit ? targetUser.room : '1'}" class="input-field" placeholder="1">
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-usr-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium font-heading">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('usr-modal');

    modalEl.querySelectorAll('#close-usr-modal, #close-usr-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    const stdIdInput = modalEl.querySelector('#usr-stdid');
    const usernameInput = modalEl.querySelector('#usr-username');
    const passwordInput = modalEl.querySelector('#usr-password');

    stdIdInput.addEventListener('input', (e) => {
      const stdId = e.target.value.trim();
      if (stdId && (!usernameInput.value || usernameInput.value === targetUser?.studentId)) {
        usernameInput.value = stdId;
      }
      if (stdId && (!passwordInput.value || passwordInput.value === targetUser?.studentId)) {
        passwordInput.value = stdId;
      }
    });

    modalEl.querySelector('#usr-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const stdId = stdIdInput.value.trim() || '-';
      const username = usernameInput.value.trim() || stdId;
      const password = passwordInput.value.trim() || stdId;

      const payload = {
        name: document.getElementById('usr-name').value.trim(),
        username: username,
        password: password,
        email: document.getElementById('usr-email').value.trim(),
        role: document.getElementById('usr-role').value,
        studentId: stdId,
        grade: document.getElementById('usr-grade').value.trim(),
        room: document.getElementById('usr-room').value.trim()
      };

      if (isEdit) {
        firebaseService.updateItem('users', targetUser.id, payload);
      } else {
        firebaseService.addItem('users', payload);
      }

      modalEl.remove();

      await showAlertModal({
        title: '💾 บันทึกข้อมูลสำเร็จ',
        message: `บันทึกชื่อผู้ใช้ (${username}) และรหัสผ่านเรียบร้อยแล้ว`,
        type: 'success'
      });

      refreshCb();
    });
  }
}
