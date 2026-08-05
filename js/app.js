/**
 * Main Application Controller & Router (With Automatic Cache-Busting System v=11.0)
 * Handles authentication checks, tab navigation, settings rendering,
 * central server 0.1s real-time updates across all devices, and user avatar updates.
 */

import { RBACModule } from './modules/rbac.js?v=11.0';
import { DashboardModule } from './modules/dashboard.js?v=11.0';
import { StudentsModule } from './modules/students.js?v=11.0';
import { HomeworkModule } from './modules/homework.js?v=11.0';
import { QuizModule } from './modules/quiz.js?v=11.0';
import { AttendanceModule } from './modules/attendance.js?v=11.0';
import { GradebookModule } from './modules/gradebook.js?v=11.0';
import { SettingsModule } from './modules/settings.js?v=11.0';
import { syncEngine } from './services/syncEngine.js?v=11.0';
import { decodeMojibakeThai } from './services/mojibakeDecoder.js?v=11.0';

class SchoolApp {
  constructor() {
    this.activeTab = 'dashboard';
    this.rbac = new RBACModule((user) => this.handleAuthChange(user));

    this.settingsModule = new SettingsModule(this.rbac, () => this.handleSettingsUpdated());
    this.dashboardModule = new DashboardModule(this.rbac, (tab) => this.switchTab(tab), this.settingsModule);
    this.studentsModule = new StudentsModule(this.rbac);
    this.homeworkModule = new HomeworkModule(this.rbac);
    this.quizModule = new QuizModule(this.rbac);
    this.attendanceModule = new AttendanceModule(this.rbac);
    this.gradebookModule = new GradebookModule(this.rbac);

    this.initSyncStatus();
    this.renderHeader();
    this.renderActiveTab();

    // 🌐 Central Primary Server 0.1s Realtime Sync Listener for all connected devices
    window.addEventListener('ag_realtime_update', () => {
      // 🛡️ UNIVERSAL UI & SESSION PROTECTION SHIELD
      // Prevent kicking user out or resetting active screens during live updates:
      
      // 1. Check if user is currently taking an active quiz
      const isQuizActive = this.activeTab === 'quiz' && this.quizModule && this.quizModule.isSessionActive;

      // 2. Check if any modal or pop-up window is open on screen
      const hasOpenModal = !!document.querySelector('.fixed.inset-0, [id*="modal"], [id*="dialog"]');

      // 3. Check if user is actively typing in any input, textarea, or select field
      const activeEl = document.activeElement;
      const isTyping = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable);

      if (isQuizActive || hasOpenModal || isTyping) {
        // Silently keep background data updated without wiping UI or kicking user out!
        return;
      }

      this.renderActiveTab();
    });
  }

  handleSettingsUpdated() {
    this.renderHeader();
    this.renderActiveTab();
  }

  initSyncStatus() {
    syncEngine.subscribe(({ status, pendingCount }) => {
      const badge = document.getElementById('sync-status-badge');
      if (!badge) return;

      if (status === 'synced' || status === 'syncing') {
        badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1.5';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Central Server Live (0.1s)';
      } else {
        badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1.5';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span> Offline Local Cache';
      }
    });
  }

  handleAuthChange(user) {
    if (!user) {
      this.activeTab = 'dashboard';
    }
    this.renderHeader();
    this.renderActiveTab();
  }

  switchTab(tabName) {
    if (tabName !== 'quiz' && this.quizModule) {
      this.quizModule.isSessionActive = false;
    }
    this.activeTab = tabName;
    this.renderHeader();
    this.renderActiveTab();
  }

  renderHeader() {
    const headerContainer = document.getElementById('app-header');
    if (!headerContainer) return;

    if (!this.rbac.isAuthenticated()) {
      headerContainer.innerHTML = '';
      return;
    }

    const currentUser = this.rbac.getCurrentUser();
    const settings = this.settingsModule.getSettings();

    // Default avatar icon per role if not customized
    const defaultAvatar = currentUser.role === 'Admin' ? '👑' : currentUser.role === 'Teacher' ? '👨‍🏫' : '🎓';
    const avatarContent = currentUser.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:image'))
      ? `<img src="${currentUser.avatar}" class="w-full h-full object-cover rounded-full">`
      : `<span class="text-base">${currentUser.avatar || defaultAvatar}</span>`;

    // Navigation Tabs Allowed per Role
    const allTabs = [
      { id: 'dashboard', label: '🖥️ Dashboard', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'students', label: '👨‍🎓 รายชื่อนักเรียน', roles: ['Admin', 'Teacher'] },
      { id: 'homework', label: '📚 วิชา/การบ้าน', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'quiz', label: '✨ แบบทดสอบ', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'attendance', label: '⏱️ เช็กชื่อรายคาบ', roles: ['Admin', 'Teacher'] },
      { id: 'gradebook', label: '📊 คะแนน/รายงาน', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'users', label: '👑 จัดการผู้ใช้ (RBAC)', roles: ['Admin'] },
      { id: 'settings', label: '⚙️ ตั้งค่าระบบ', roles: ['Admin', 'Teacher'] },
    ];

    const visibleTabs = allTabs.filter(t => t.roles.includes(currentUser.role));

    // Ensure active tab is allowed for current role
    if (!visibleTabs.some(t => t.id === this.activeTab)) {
      this.activeTab = visibleTabs[0].id;
    }

    headerContainer.innerHTML = `
      <header class="glass-nav sticky top-0 z-50 px-3 lg:px-6 py-2 transition-colors">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
          <!-- Logo & Brand -->
          <div class="flex items-center justify-between w-full md:w-auto shrink-0">
            <div class="flex items-center gap-2.5 cursor-pointer group shrink-0" id="brand-logo">
              <div class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm overflow-hidden p-0.5 group-hover:scale-105 transition-transform shrink-0">
                <img src="./logo.jpg" alt="โรงเรียนพรมเทพวิทยาคม" class="w-full h-full object-contain">
              </div>
              <div class="shrink-0">
                <div class="font-heading font-extrabold text-base tracking-tight text-slate-800 whitespace-nowrap">
                  ${decodeMojibakeThai(settings.schoolName)}
                </div>
                <div class="text-[11px] text-slate-500 font-heading whitespace-nowrap">ระบบบริหารจัดการห้องเรียนอัจฉริยะ (${settings.semester}/${settings.academicYear})</div>
              </div>
            </div>

            <!-- Mobile Controls -->
            <div class="flex md:hidden items-center gap-1.5">
              <button id="btn-avatar-mobile" class="w-8 h-8 rounded-full bg-white border border-sky-300 flex items-center justify-center overflow-hidden">
                ${avatarContent}
              </button>
              <button id="btn-change-pass-mobile" class="text-xs text-sky-800 font-bold px-2 py-1 bg-sky-100 rounded-lg border border-sky-200">🔑 รหัสผ่าน</button>
              <button id="btn-logout-mobile" class="text-xs text-rose-600 font-bold px-2 py-1 bg-rose-50 rounded-lg border border-rose-200">🚪 ออกระบบ</button>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <nav class="flex items-center gap-1 overflow-x-auto w-full md:w-auto py-0.5 scrollbar-none">
            ${visibleTabs.map(t => `
              <button 
                data-tab="${t.id}" 
                class="tab-btn px-3 py-1.5 rounded-xl text-xs font-heading whitespace-nowrap transition-all ${
                  this.activeTab === t.id ? 'nav-tab-active' : 'nav-tab-inactive'
                }"
              >
                ${t.label}
              </button>
            `).join('')}
          </nav>

          <!-- Right Toolbar & User Profile Avatar Actions -->
          <div class="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
            <!-- Sync Status Badge -->
            <div id="sync-status-badge"></div>

            <!-- Read-Only Static Role Badge -->
            <div class="flex items-center gap-1 bg-white/90 px-2.5 py-1 rounded-xl border border-sky-200 text-xs font-heading font-bold shrink-0 whitespace-nowrap ${
              currentUser.role === 'Admin' ? 'text-purple-700 bg-purple-50/80 border-purple-200' :
              currentUser.role === 'Teacher' ? 'text-sky-800 bg-sky-100/80 border-sky-200' :
              'text-emerald-700 bg-emerald-50/80 border-emerald-200'
            }">
              <span class="text-[10px] text-slate-400 font-normal">สิทธิ์:</span>
              <span>${currentUser.role === 'Admin' ? '👑 Admin' : currentUser.role === 'Teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}</span>
            </div>

            <!-- User Profile Avatar & Actions -->
            <div class="hidden sm:flex items-center gap-2 pl-2 border-l border-sky-200/90 shrink-0">
              <button id="btn-user-avatar" class="relative group cursor-pointer shrink-0" title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์">
                <div class="w-8 h-8 rounded-full bg-white border-2 border-sky-400 group-hover:border-indigo-600 flex items-center justify-center overflow-hidden shadow-sm transition-all group-hover:scale-105">
                  ${avatarContent}
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-sky-600 text-white rounded-full text-[8px] flex items-center justify-center shadow">✏️</span>
              </button>

              <div class="text-right shrink-0">
                <div class="text-xs font-heading font-bold text-slate-900 leading-tight whitespace-nowrap">${decodeMojibakeThai(currentUser.name)}</div>
                <div class="text-[10px] text-slate-500 font-mono mt-0.5 whitespace-nowrap">${currentUser.email || currentUser.studentId || ''}</div>
              </div>

              <!-- Sleek Compact Action Buttons -->
              <button id="btn-change-pass" class="bg-white/90 hover:bg-sky-50 text-sky-700 hover:text-sky-800 border border-sky-200/90 hover:border-sky-300 text-xs px-2.5 py-1 rounded-xl font-heading font-semibold transition-all shadow-xs flex items-center gap-1 shrink-0 whitespace-nowrap" title="เปลี่ยนรหัสผ่าน">
                <span>🔑</span> เปลี่ยนรหัส
              </button>

              <button id="btn-logout" class="bg-rose-50/80 hover:bg-rose-100/90 text-rose-600 hover:text-rose-700 border border-rose-200/80 hover:border-rose-300 text-xs px-2.5 py-1 rounded-xl font-heading font-semibold transition-all shadow-xs flex items-center gap-1 shrink-0 whitespace-nowrap" title="ออกจากระบบ">
                <span>🚪</span> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </header>
    `;

    // Event Listeners
    headerContainer.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.dataset.tab);
      });
    });

    headerContainer.querySelector('#btn-user-avatar')?.addEventListener('click', () => this.rbac.showAvatarModal());
    headerContainer.querySelector('#btn-avatar-mobile')?.addEventListener('click', () => this.rbac.showAvatarModal());
    headerContainer.querySelector('#btn-change-pass')?.addEventListener('click', () => this.rbac.showChangePasswordModal());
    headerContainer.querySelector('#btn-change-pass-mobile')?.addEventListener('click', () => this.rbac.showChangePasswordModal());
    headerContainer.querySelector('#btn-logout')?.addEventListener('click', () => this.rbac.logout());
    headerContainer.querySelector('#btn-logout-mobile')?.addEventListener('click', () => this.rbac.logout());
  }

  renderActiveTab() {
    const mainContainer = document.getElementById('app-content');
    if (!mainContainer) return;

    if (!this.rbac.isAuthenticated()) {
      this.rbac.renderLoginScreen(mainContainer);
      return;
    }

    if (this.activeTab === 'dashboard') {
      this.dashboardModule.render(mainContainer);
    } else if (this.activeTab === 'students') {
      this.studentsModule.render(mainContainer);
    } else if (this.activeTab === 'homework') {
      this.homeworkModule.render(mainContainer);
    } else if (this.activeTab === 'quiz') {
      this.quizModule.render(mainContainer);
    } else if (this.activeTab === 'attendance') {
      this.attendanceModule.render(mainContainer);
    } else if (this.activeTab === 'gradebook') {
      this.gradebookModule.render(mainContainer);
    } else if (this.activeTab === 'users' && this.rbac.canManageUsers()) {
      this.rbac.renderUserManagement(mainContainer, () => this.renderActiveTab());
    } else if (this.activeTab === 'settings') {
      this.settingsModule.render(mainContainer);
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SchoolApp();
});
