/**
 * Dashboard Module (With Cache-Busting Version Query v=2.5)
 * Ultra-modern Futuristic LIGHT Welcome Banner with Real-Time Digital Clock & Live Date,
 * Overview KPI cards, Announcements CRUD, and Quick Shortcuts.
 */

import { firebaseService } from '../services/firebaseService.js?v=2.5';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js?v=2.5';
import { showConfirmModal } from '../services/dialogService.js?v=2.5';

export class DashboardModule {
  constructor(rbac, navigateToTab, settingsModule) {
    this.rbac = rbac;
    this.navigateToTab = navigateToTab;
    this.settingsModule = settingsModule;
    this.clockTimer = null;
  }

  startRealtimeClock() {
    const updateClock = () => {
      const clockEl = document.getElementById('realtime-clock');
      const dateEl = document.getElementById('realtime-date');
      if (!clockEl || !dateEl) return;

      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      clockEl.textContent = `${hours}:${minutes}:${seconds} น.`;

      // Thai Date Formatting
      const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
      const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
      
      const dayName = thaiDays[now.getDay()];
      const dayNum = now.getDate();
      const monthName = thaiMonths[now.getMonth()];
      const yearBE = now.getFullYear() + 543;

      dateEl.textContent = `${dayName}ที่ ${dayNum} ${monthName} ${yearBE}`;
    };

    updateClock();
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = setInterval(updateClock, 1000);
  }

  render(containerEl) {
    const users = firebaseService.getCollection('users');
    const courses = firebaseService.getCollection('courses');
    const announcements = firebaseService.getCollection('announcements');
    const homework = firebaseService.getCollection('homework');
    const quizzes = firebaseService.getCollection('quizzes');
    const currentUser = this.rbac.getCurrentUser();
    const settings = this.settingsModule ? this.settingsModule.getSettings() : {
      bannerTitle: 'ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่',
      schoolName: 'Cloud Classroom',
      academicYear: '2026',
      semester: 'ภาคเรียนที่ 1'
    };

    const totalStudents = users.filter(u => u.role === 'Student').length;
    const activeCourses = courses.length;
    const pendingSubmissions = homework.reduce((acc, hw) => acc + (hw.submissions ? hw.submissions.filter(s => s.status === 'Pending').length : 0), 0);
    const totalQuizzes = quizzes.length;

    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in">
        <!-- Futuristic Clean Light Glass Banner with Real-Time Clock -->
        <div class="relative overflow-hidden rounded-3xl bg-white p-8 md:p-10 shadow-lg shadow-indigo-500/5 border border-slate-200/90">
          <!-- Subtle Pastel Ambient Mesh Accents -->
          <div class="absolute -right-16 -top-16 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute left-1/3 -bottom-16 w-80 h-80 bg-purple-100/50 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute right-1/4 top-1/2 w-64 h-64 bg-pink-100/40 rounded-full blur-2xl pointer-events-none"></div>

          <div class="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <!-- Left Info Section -->
            <div class="space-y-4 max-w-2xl">
              <!-- Header Badges & Real-Time Clock Pill -->
              <div class="flex flex-wrap items-center gap-2.5">
                <div class="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-heading font-bold border border-indigo-200/80 shadow-sm">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>👋 สวัสดีคุณ</span>
                  <span class="font-extrabold text-indigo-900 underline underline-offset-2">${decodeMojibakeThai(currentUser.name)}</span>
                  <span class="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm">${currentUser.role}</span>
                </div>

                <!-- High-Contrast Digital Clock & Live Date Badge -->
                <div class="inline-flex items-center gap-2.5 px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-mono font-bold border border-slate-800 shadow-md">
                  <span class="text-amber-400 animate-pulse">⏰</span>
                  <span id="realtime-clock" class="tracking-widest text-sm text-amber-300">00:00:00 น.</span>
                  <span class="text-slate-600">|</span>
                  <span id="realtime-date" class="font-heading font-medium text-[11px] text-slate-300">...</span>
                </div>
              </div>

              <!-- Main Title in Crisp High-Contrast Slate-900 -->
              <h1 class="text-3xl md:text-4xl lg:text-4xl font-extrabold font-heading tracking-tight leading-snug text-slate-900">
                ${decodeMojibakeThai(settings.bannerTitle)}
              </h1>

              <!-- School & Semester Subtitle -->
              <div class="flex items-center gap-2 text-slate-600 text-xs md:text-sm font-heading">
                <span class="p-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">🏫</span>
                <span class="font-semibold text-slate-800">${decodeMojibakeThai(settings.schoolName)}</span>
                <span class="text-slate-300">•</span>
                <span class="bg-slate-100 text-slate-700 px-3 py-0.5 rounded-full text-xs font-semibold border border-slate-200">${settings.semester} ปีการศึกษา ${settings.academicYear}</span>
              </div>
            </div>

            <!-- Right Futuristic Light Shortcuts -->
            <div class="flex flex-wrap lg:flex-col gap-3 shrink-0 w-full sm:w-auto">
              ${this.rbac.canEditAnnouncements() ? `
                <button id="quick-add-announcement" class="bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-heading font-bold px-6 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm border border-slate-200/90 shadow-sm hover:scale-[1.02]">
                  <span class="text-base">📢</span> ประกาศข่าวสารใหม่
                </button>
              ` : ''}
              ${this.rbac.canManageHomework() ? `
                <button id="quick-create-hw" class="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-800 text-white font-heading font-bold px-6 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm shadow-lg shadow-indigo-500/25 border border-indigo-400/30 hover:scale-[1.02]">
                  <span class="text-base">📚</span> สั่งการบ้านใหม่
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Futuristic Interactive KPI Metrics Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <!-- KPI 1 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-indigo-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-2xl font-bold p-3">
                👨‍🎓
              </div>
              <span class="text-[10px] font-bold font-heading bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">📈 Active</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">นักเรียนในระบบทั้งหมด</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${totalStudents} <span class="text-xs font-normal text-slate-500">คน</span></div>
            </div>
          </div>

          <!-- KPI 2 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-purple-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-13 h-13 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-2xl font-bold p-3">
                📖
              </div>
              <span class="text-[10px] font-bold font-heading bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">✨ 100% Online</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">รายวิชาที่เปิดสอน</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${activeCourses} <span class="text-xs font-normal text-slate-500">วิชา</span></div>
            </div>
          </div>

          <!-- KPI 3 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-amber-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-2xl font-bold p-3">
                📝
              </div>
              <span class="text-[10px] font-bold font-heading bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">⏳ ต้องตรวจ</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">รอตรวจการบ้าน</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${pendingSubmissions} <span class="text-xs font-normal text-slate-500">รายการ</span></div>
            </div>
          </div>

          <!-- KPI 4 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-emerald-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-2xl font-bold p-3">
                ✨
              </div>
              <span class="text-[10px] font-bold font-heading bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">🎯 Auto-Grade</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">แบบทดสอบในระบบ</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${totalQuizzes} <span class="text-xs font-normal text-slate-500">ชุด</span></div>
            </div>
          </div>
        </div>

        <!-- Announcements Section -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200">
          <div class="flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
            <div>
              <h2 class="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
                <span>📢</span> ประกาศข่าวสารห้องเรียน
              </h2>
              <p class="text-slate-500 text-xs mt-1">อัปเดตข้อมูลสำคัญ ข่าวสารกิจกรรม และกำหนดการสอบ</p>
            </div>
            ${this.rbac.canEditAnnouncements() ? `
              <button id="btn-create-announcement" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-heading font-bold flex items-center gap-1.5">
                <span>➕</span> เพิ่มประกาศ
              </button>
            ` : ''}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${announcements.length === 0 ? `
              <div class="col-span-2 text-center py-12 text-slate-400">ยังไม่มีประกาศข่าวสารในขณะนี้</div>
            ` : announcements.map(anc => `
              <div class="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 relative group hover:border-indigo-300 hover:bg-white transition-all shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start gap-3">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold font-heading uppercase tracking-wider ${
                      anc.priority === 'Urgent' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                      anc.priority === 'Exam' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                      'bg-blue-50 text-blue-600 border border-blue-200'
                    }">
                      ${anc.priority === 'Urgent' ? '🔥 ด่วนที่สุด' : anc.priority === 'Exam' ? '✍️ กำหนดสอบ' : '📌 ทั่วไป'}
                    </span>
                    <div class="text-[11px] text-slate-400 font-mono">${anc.date}</div>
                  </div>

                  <h3 class="font-bold font-heading text-slate-900 text-lg mt-3 group-hover:text-indigo-600 transition-colors leading-snug">
                    ${decodeMojibakeThai(anc.title)}
                  </h3>
                  <p class="text-slate-600 text-sm mt-2 leading-relaxed">
                    ${decodeMojibakeThai(anc.content)}
                  </p>
                </div>

                <div class="mt-5 pt-3 border-t border-slate-200/80 flex justify-between items-center text-xs text-slate-500">
                  <span>ผู้ประกาศ: <strong class="text-slate-800 font-semibold">${decodeMojibakeThai(anc.author)}</strong></span>
                  ${this.rbac.canEditAnnouncements() ? `
                    <div class="flex gap-2">
                      <button data-edit-anc="${anc.id}" class="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1">แก้ไข</button>
                      <button data-del-anc="${anc.id}" data-anc-title="${decodeMojibakeThai(anc.title)}" class="text-rose-600 hover:text-rose-800 font-semibold px-2 py-1">ลบ</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Start Real-Time Digital Clock Ticker
    this.startRealtimeClock();

    // Event Handlers
    containerEl.querySelector('#quick-add-announcement')?.addEventListener('click', () => this.showAnnouncementModal(null, () => this.render(containerEl)));
    containerEl.querySelector('#btn-create-announcement')?.addEventListener('click', () => this.showAnnouncementModal(null, () => this.render(containerEl)));
    containerEl.querySelector('#quick-create-hw')?.addEventListener('click', () => this.navigateToTab('homework'));

    containerEl.querySelectorAll('[data-edit-anc]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.editAnc;
        const anc = announcements.find(a => a.id === id);
        this.showAnnouncementModal(anc, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-del-anc]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.delAnc;
        const ancTitle = e.currentTarget.dataset.ancTitle;

        const confirmed = await showConfirmModal({
          title: '📢 ยืนยันการลบประกาศข่าวสาร',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบประกาศ "${ancTitle}"?`,
          confirmText: 'ลบประกาศ',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('announcements', id);
          this.render(containerEl);
        }
      });
    });
  }

  showAnnouncementModal(anc, refreshCb) {
    const isEdit = !!anc;
    const currentUser = this.rbac.getCurrentUser();

    const modalHTML = `
      <div id="anc-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-lg p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">
              ${isEdit ? '✏️ แก้ไขประกาศข่าวสาร' : '📢 เพิ่มประกาศข่าวสาร'}
            </h3>
            <button id="close-anc-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="anc-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">หัวข้อประกาศ</label>
              <input type="text" id="anc-title" value="${isEdit ? anc.title : ''}" required class="input-field" placeholder="เช่น แจ้งกำหนดการส่งงานวิชาคณิตศาสตร์">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ระดับความสำคัญ</label>
              <select id="anc-priority" class="input-field">
                <option value="General" ${isEdit && anc.priority === 'General' ? 'selected' : ''}>📌 ทั่วไป (General)</option>
                <option value="Urgent" ${isEdit && anc.priority === 'Urgent' ? 'selected' : ''}>🔥 ด่วนที่สุด (Urgent)</option>
                <option value="Exam" ${isEdit && anc.priority === 'Exam' ? 'selected' : ''}>✍️ กำหนดสอบ (Exam)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">รายละเอียดประกาศ</label>
              <textarea id="anc-content" rows="4" required class="input-field" placeholder="พิมพ์รายละเอียดประกาศ...">${isEdit ? anc.content : ''}</textarea>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-anc-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2 rounded-xl text-sm font-medium font-heading">บันทึกประกาศ</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('anc-modal');

    modalEl.querySelectorAll('#close-anc-modal, #close-anc-btn').forEach(btn => btn.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#anc-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('anc-title').value.trim(),
        priority: document.getElementById('anc-priority').value,
        content: document.getElementById('anc-content').value.trim(),
        author: currentUser.name,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };

      if (isEdit) {
        firebaseService.updateItem('announcements', anc.id, payload);
      } else {
        firebaseService.addItem('announcements', payload);
      }

      modalEl.remove();
      refreshCb();
    });
  }
}
