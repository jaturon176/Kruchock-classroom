/**
 * Quiz Module (แบบทดสอบออนไลน์พร้อมแดชบอร์ดสถิติ)
 * Pro-level Quiz Management: 
 * - Choice Count Selector Popup (4 ตัวเลือก vs 5 ตัวเลือกก่อนสร้างข้อสอบ)
 * - Custom Question Scores
 * - Removed Explanation box
 * - Image Uploads for Questions & Options (จากเครื่องหรือ URL)
 * - Real-Time Countdown Timer & Instant Auto-Grading.
 * - Teacher Score Directory & Filtering per Student / per Classroom Room.
 * - Delete Student Score Attempt (Reset Score so Student can Re-take).
 * - Toggle Open / Close Quiz Access (เปิด/ปิด รับการทำแบบทดสอบ).
 */

import { firebaseService } from '../services/firebaseService.js?v=4.0';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js?v=4.0';
import { showConfirmModal, showAlertModal } from '../services/dialogService.js?v=4.0';

export class QuizModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.quizTimer = null;
    this.isSessionActive = false;

    // Listen for 0.1s Cloud Realtime Database updates across all devices
    window.addEventListener('ag_realtime_update', (e) => {
      if (e.detail && (e.detail.collection === 'quizzes' || e.detail.collection === 'courses')) {
        // Prevent resetting active quiz session if student is in the middle of taking a test!
        if (this.isSessionActive) {
          return;
        }

        const activeContainer = document.getElementById('app-content');
        if (activeContainer && window.app && window.app.activeTab === 'quiz') {
          this.render(activeContainer);
        }
      }
    });
  }

  // Deep sanitize object for Firebase DB (Ensures no undefined values cause set() crashes)
  sanitizeForFirebase(obj) {
    if (obj === undefined) return '';
    if (obj === null) return '';
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirebase(item));
    }
    if (typeof obj === 'object') {
      const clean = {};
      for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          clean[k] = this.sanitizeForFirebase(obj[k]);
        }
      }
      return clean;
    }
    return obj;
  }

  render(containerEl) {
    if (this.isSessionActive) {
      return;
    }

    let quizzes = firebaseService.getCollection('quizzes');
    const courses = firebaseService.getCollection('courses');
    const currentUser = this.rbac.getCurrentUser();

    // Filter quizzes by target grade & multi-room assignment for Students
    if (currentUser.role === 'Student') {
      quizzes = quizzes.filter(q => {
        const tGrade = q.targetGrade || 'All';
        const tRooms = q.targetRooms || ['All'];

        if (tGrade !== 'All' && currentUser.grade && currentUser.grade !== '-' && tGrade !== currentUser.grade) {
          return false;
        }
        if (!tRooms.includes('All') && currentUser.room && currentUser.room !== '-' && !tRooms.includes(currentUser.room)) {
          return false;
        }
        return true;
      });
    }

    // Filter quizzes by teacher ownership for Teacher role (Teachers see ONLY their own created/taught quizzes)
    if (currentUser.role === 'Teacher') {
      quizzes = quizzes.filter(q => {
        const targetCourse = courses.find(c => c.id === q.courseId);
        const isMyCourse = targetCourse && decodeMojibakeThai(targetCourse.teacher) === decodeMojibakeThai(currentUser.name);
        const isMyCreation = (q.creatorId && q.creatorId === currentUser.id) || 
                             (q.creatorName && decodeMojibakeThai(q.creatorName) === decodeMojibakeThai(currentUser.name));

        return isMyCourse || isMyCreation;
      });
    }

    // Calculate Quiz Statistics
    const totalQuizzes = quizzes.length;
    let totalAttempts = 0;
    let totalScoreSum = 0;
    let totalMaxSum = 0;
    let passedAttempts = 0;

    quizzes.forEach(q => {
      if (q.results && Array.isArray(q.results)) {
        totalAttempts += q.results.length;
        q.results.forEach(r => {
          totalScoreSum += (r.score || 0);
          totalMaxSum += (r.maxScore || (q.questions ? q.questions.length : 1));
          if (r.maxScore > 0 && (r.score / r.maxScore) >= 0.5) {
            passedAttempts++;
          }
        });
      }
    });

    const avgScorePercent = totalMaxSum > 0 ? Math.round((totalScoreSum / totalMaxSum) * 100) : 0;
    const passRatePercent = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in">
        <!-- Header & Action Controls -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 text-xl">✨</span>
              ระบบแบบทดสอบออนไลน์ (Online Examination System)
            </h2>
            <p class="text-slate-500 text-xs mt-1">สร้างแบบทดสอบ 4 หรือ 5 ตัวเลือก, กำหนดคะแนนรายข้อ, แนบรูปภาพโจทย์, เปิด/ปิด รับข้อสอบ, ดูและลบคะแนนนักเรียนรายห้อง</p>
          </div>

          ${this.rbac.canCreateQuiz() ? `
            <div class="flex flex-wrap items-center gap-3">
              <button id="btn-create-quiz" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-heading font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/20">
                <span>➕</span> สร้างแบบทดสอบใหม่
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Quiz Analytics & Statistics Dashboard -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <!-- KPI 1 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-purple-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-xl font-bold p-2.5">
                📝
              </div>
              <span class="text-[10px] font-bold font-heading bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">🎯 Auto-Grade</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">แบบทดสอบทั้งหมด</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${totalQuizzes} <span class="text-xs font-normal text-slate-500">ชุด</span></div>
            </div>
          </div>

          <!-- KPI 2 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-indigo-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-xl font-bold p-2.5">
                🎓
              </div>
              <span class="text-[10px] font-bold font-heading bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">📈 100% Verified</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">ผู้เข้าทำข้อสอบแล้ว</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${totalAttempts} <span class="text-xs font-normal text-slate-500">ครั้ง</span></div>
            </div>
          </div>

          <!-- KPI 3 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-emerald-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-xl font-bold p-2.5">
                🌟
              </div>
              <span class="text-[10px] font-bold font-heading bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">📊 Average</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">คะแนนเฉลี่ยรวม</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${avgScorePercent}% <span class="text-xs font-normal text-slate-500">ของคะแนนเต็ม</span></div>
            </div>
          </div>

          <!-- KPI 4 -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-amber-300 transition-all hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-xl font-bold p-2.5">
                🏆
              </div>
              <span class="text-[10px] font-bold font-heading bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">✅ Standard Met</span>
            </div>
            <div class="mt-4">
              <div class="text-slate-500 text-xs font-heading font-semibold uppercase tracking-wider">อัตราการสอบผ่านเกณฑ์</div>
              <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">${passRatePercent}% <span class="text-xs font-normal text-slate-500">(>= 50%)</span></div>
            </div>
          </div>
        </div>

        <!-- Quiz Items Grid -->
        <div class="space-y-4">
          <h3 class="text-lg font-bold text-slate-900 font-heading flex items-center justify-between">
            <span>📚 รายการแบบทดสอบในระบบ</span>
            <span class="text-xs font-normal text-slate-500">จำนวน ${quizzes.length} ชุด</span>
          </h3>

          ${quizzes.length === 0 ? `
            <div class="glass-card p-12 text-center text-slate-400 rounded-3xl bg-white border border-slate-200">
              ยังไม่มีชุดแบบทดสอบในขณะนี้ กดปุ่ม "➕ สร้างแบบทดสอบใหม่" เพื่อเริ่มต้น
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              ${quizzes.map(q => {
                const targetCourse = courses.find(c => c.id === q.courseId);
                const qCount = q.questions ? q.questions.length : 0;
                const totalPoints = q.questions ? q.questions.reduce((sum, item) => sum + (parseInt(item.points, 10) || 1), 0) : qCount;
                const optionType = q.optionCount || (q.questions && q.questions[0] && q.questions[0].options ? q.questions[0].options.length : 4);
                const myResult = q.results ? q.results.find(r => r.studentId === currentUser.studentId) : null;
                const attemptsCount = q.results ? q.results.length : 0;
                const isOpen = q.isOpen !== false; // Default is open

                return `
                  <div class="glass-card p-6 md:p-7 rounded-3xl shadow-sm bg-white border border-slate-200 flex flex-col justify-between space-y-4 hover:border-purple-300 transition-all">
                    <div class="space-y-3">
                      <div class="flex justify-between items-start gap-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="bg-purple-50 text-purple-700 border border-purple-100 text-xs px-3 py-1 rounded-xl font-bold font-heading">
                            ${targetCourse ? targetCourse.name : 'ทั่วไป'}
                          </span>
                          <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-2.5 py-1 rounded-xl font-bold">
                            ${optionType} ตัวเลือก
                          </span>
                          <span class="bg-pink-50 text-pink-700 border border-pink-100 text-xs px-2.5 py-1 rounded-xl font-bold font-heading">
                            🎯 มอบหมายให้: ${q.targetGrade && q.targetGrade !== 'All' ? q.targetGrade : ''} (${!q.targetRooms || q.targetRooms.includes('All') ? 'ทุกห้อง' : `ห้อง ${q.targetRooms.join(', ')}`})
                          </span>
                        </div>

                        <!-- Open/Closed Access Badge -->
                        <span class="text-xs font-bold px-2.5 py-1 rounded-xl font-heading ${
                          isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }">
                          ${isOpen ? '🟢 เปิดรับคำตอบ' : '🔒 ปิดรับคำตอบ'}
                        </span>
                      </div>

                      <h3 class="text-xl font-bold text-slate-900 font-heading leading-snug">
                        ${decodeMojibakeThai(q.title)}
                      </h3>
                      <p class="text-slate-600 text-xs leading-relaxed">
                        ${decodeMojibakeThai(q.description || 'ไม่มีคำอธิบาย')}
                      </p>

                      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>❓ จำนวน: <strong class="text-slate-900 font-bold">${qCount} ข้อ (${totalPoints} คะแนน)</strong></span>
                        <span>⏱️ เวลา: <strong class="text-slate-900 font-bold">${q.timeLimitMinutes || 5} นาที</strong></span>
                        <span>📊 ทำแล้ว: <strong class="text-indigo-600 font-bold">${attemptsCount} ครั้ง</strong></span>
                      </div>
                    </div>

                    <!-- Action Bar -->
                    <div class="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                      <!-- Student Action -->
                      ${this.rbac.canTakeQuiz() && currentUser.role === 'Student' ? `
                        ${!isOpen ? `
                          <span class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            🔒 ปิดรับการทำแบบทดสอบแล้ว
                          </span>
                        ` : myResult ? `
                          <div class="flex items-center gap-2">
                            <span class="px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                              (myResult.score / myResult.maxScore) >= 0.5 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }">
                              ${(myResult.score / myResult.maxScore) >= 0.5 ? '✅' : '⚠️'} คะแนน: ${myResult.score}/${myResult.maxScore}
                            </span>
                            <button data-take-quiz="${q.id}" class="btn-secondary text-xs px-3.5 py-1.5 rounded-xl font-heading font-semibold">ทำข้อสอบอีกครั้ง</button>
                          </div>
                        ` : `
                          <button data-take-quiz="${q.id}" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-heading font-bold shadow-md">✏️ เริ่มทำแบบทดสอบ</button>
                        `}
                      ` : ''}

                      <!-- Teacher / Admin Actions -->
                      ${this.rbac.canCreateQuiz() ? `
                        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                          <!-- Toggle Open / Closed Status -->
                          <button data-toggle-quiz="${q.id}" class="text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                            isOpen ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                          }">
                            ${isOpen ? '🔴 ปิดรับข้อสอบ' : '🟢 เปิดรับข้อสอบ'}
                          </button>

                          <!-- View Student Scores Directory & Filter Button -->
                          <button data-view-scores="${q.id}" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all">
                            📊 ดูคะแนน (${attemptsCount})
                          </button>

                          <button data-edit-quiz="${q.id}" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all">✏️ แก้ไข</button>
                          <button data-del-quiz="${q.id}" data-quiz-title="${decodeMojibakeThai(q.title)}" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all">🗑️ ลบ</button>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    // Click handler for Create Quiz (Opens 4 vs 5 Option Type Selector Popup)
    containerEl.querySelector('#btn-create-quiz')?.addEventListener('click', () => {
      this.showOptionTypePromptModal((optionCount) => {
        this.showQuizEditorModal(null, () => this.render(containerEl), optionCount);
      });
    });

    // Toggle Open/Closed Access Handler
    containerEl.querySelectorAll('[data-toggle-quiz]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.toggleQuiz;
        const q = quizzes.find(item => item.id === id);
        if (q) {
          const newStatus = q.isOpen === false ? true : false;
          await firebaseService.updateItem('quizzes', id, { isOpen: newStatus });
          this.render(containerEl);
        }
      });
    });

    // View Student Scores Directory Handler
    containerEl.querySelectorAll('[data-view-scores]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.viewScores;
        const q = quizzes.find(item => item.id === id);
        this.showQuizScoresModal(q, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-edit-quiz]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.editQuiz;
        const q = quizzes.find(item => item.id === id);
        this.showQuizEditorModal(q, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-del-quiz]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.delQuiz;
        const title = e.currentTarget.dataset.quizTitle;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบแบบทดสอบ',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบชุดแบบทดสอบ "${title}"? ข้อมูลประวัติการทำข้อสอบทั้งหมดจะถูกลบออก`,
          confirmText: 'ลบแบบทดสอบ',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('quizzes', id);
          this.render(containerEl);
        }
      });
    });

    containerEl.querySelectorAll('[data-take-quiz]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.takeQuiz;
        const q = quizzes.find(item => item.id === id);
        this.startQuizSession(containerEl, q);
      });
    });
  }

  // Teacher & Admin Student Scores Directory Modal (Filter per student / per room & delete score)
  showQuizScoresModal(quiz, refreshCb) {
    const users = firebaseService.getCollection('users');
    const students = users.filter(u => u.role === 'Student');

    let currentRoomFilter = 'All';
    let currentSearch = '';

    const modalHTML = `
      <div id="quiz-scores-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-4xl p-6 md:p-8 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] flex flex-col">
          <!-- Modal Header -->
          <div class="flex justify-between items-start pb-4 border-b border-slate-100 shrink-0">
            <div>
              <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-heading">
                📊 รายงานผลคะแนนสอบ
              </span>
              <h3 class="text-xl font-bold text-slate-900 font-heading mt-1 flex items-center gap-2">
                ${decodeMojibakeThai(quiz.title)}
              </h3>
            </div>
            <button id="close-scores-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <!-- Controls Bar -->
          <div class="py-4 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <div class="relative w-full sm:w-72">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input type="text" id="score-search-input" placeholder="ค้นหาชื่อหรือรหัสนักเรียน..." class="input-field pl-9 py-1.5 text-xs">
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span class="text-xs font-bold text-slate-600">🚪 ห้อง:</span>
              <select id="score-room-filter" class="input-field py-1.5 px-3 text-xs w-auto">
                <option value="All">ทุกห้องเรียน</option>
                ${[...new Set(students.map(s => `ห้อง ${s.room}`))].map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Table Container -->
          <div id="scores-table-container" class="overflow-y-auto flex-1 border border-slate-200 rounded-2xl">
          </div>

          <div class="pt-4 border-t border-slate-100 flex justify-end shrink-0">
            <button id="close-scores-btn" class="btn-primary text-xs px-6 py-2 rounded-xl font-heading font-semibold">ปิดหน้าต่าง</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('quiz-scores-modal');
    const tableContainer = modalEl.querySelector('#scores-table-container');

    const renderScoresTable = () => {
      const allQuizzes = firebaseService.getCollection('quizzes');
      const activeQuiz = allQuizzes.find(q => q.id === quiz.id) || quiz;
      const results = activeQuiz.results || [];

      // Enrich results with student profile info from users collection
      const enrichedResults = results.map(r => {
        const std = students.find(s => s.studentId === r.studentId || s.name === r.studentName);
        return {
          ...r,
          grade: std ? std.grade : '-',
          room: std ? std.room : '-',
          no: std ? std.no : '-'
        };
      });

      // Filter by room and search query
      const filtered = enrichedResults.filter(r => {
        if (currentRoomFilter !== 'All' && `ห้อง ${r.room}` !== currentRoomFilter) return false;
        if (currentSearch) {
          const q = currentSearch.toLowerCase();
          const name = decodeMojibakeThai(r.studentName || '').toLowerCase();
          const stdId = (r.studentId || '').toLowerCase();
          if (!name.includes(q) && !stdId.includes(q)) return false;
        }
        return true;
      });

      tableContainer.innerHTML = `
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 bg-slate-50">
              <th class="p-3.5 whitespace-nowrap">รหัสนักเรียน</th>
              <th class="p-3.5 whitespace-nowrap">ชื่อ-นามสกุล</th>
              <th class="p-3.5 text-center whitespace-nowrap">ชั้น/ห้อง</th>
              <th class="p-3.5 text-center whitespace-nowrap">คะแนนที่ได้</th>
              <th class="p-3.5 text-center whitespace-nowrap">สถานะ</th>
              <th class="p-3.5 text-center whitespace-nowrap">เวลาที่ส่ง</th>
              <th class="p-3.5 text-right whitespace-nowrap">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
            ${filtered.length === 0 ? `
              <tr><td colspan="7" class="text-center py-10 text-slate-400">ไม่พบประวัติการทำข้อสอบตามเงื่อนไขที่เลือก</td></tr>
            ` : filtered.map((r) => {
              const score = r.score || 0;
              const maxScore = r.maxScore || 1;
              const percent = Math.round((score / maxScore) * 100);
              const isPassed = percent >= 50;

              return `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-3.5 font-mono font-bold text-indigo-600 whitespace-nowrap">${r.studentId}</td>
                  <td class="p-3.5 font-bold text-slate-900 whitespace-nowrap">${decodeMojibakeThai(r.studentName)}</td>
                  <td class="p-3.5 text-center whitespace-nowrap">
                    <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-xl font-semibold text-xs whitespace-nowrap inline-block">${r.grade}/${r.room} (เลขที่ ${r.no})</span>
                  </td>
                  <td class="p-3.5 text-center font-bold font-mono text-sm whitespace-nowrap">
                    <span class="${isPassed ? 'text-emerald-600' : 'text-rose-600'}">${score}/${maxScore}</span>
                    <span class="text-xs text-slate-400 font-normal">(${percent}%)</span>
                  </td>
                  <td class="p-3.5 text-center whitespace-nowrap">
                    <span class="px-3 py-1 rounded-full font-bold text-xs whitespace-nowrap inline-block ${isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                      ${isPassed ? '✅ ผ่าน' : '⚠️ ไม่ผ่าน'}
                    </span>
                  </td>
                  <td class="p-3.5 text-center font-mono text-slate-500 whitespace-nowrap">${r.completedAt || '-'}</td>
                  <td class="p-3.5 text-right whitespace-nowrap">
                    <button data-del-result-id="${r.id || (r.studentId + '_' + (r.completedAt || ''))}" data-student-name="${decodeMojibakeThai(r.studentName)}" class="text-rose-600 hover:text-rose-800 font-bold px-3 py-1.5 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-all text-xs whitespace-nowrap">
                      🗑️ ลบคะแนน
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      // Bind delete score handler (deletes ONLY the single selected attempt!)
      tableContainer.querySelectorAll('[data-del-result-id]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const resId = e.currentTarget.dataset.delResultId;
          const stdName = e.currentTarget.dataset.studentName || 'นักเรียน';

          const confirmed = await showConfirmModal({
            title: '🗑️ ยืนยันการลบคะแนน',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบคะแนนสอบครั้งนี้ของ "${decodeMojibakeThai(stdName)}"? หลังจากลบแล้วนักเรียนจะสามารถเข้าทำแบบทดสอบใหม่อีกครั้งได้`,
            confirmText: 'ลบคะแนน',
            cancelText: 'ยกเลิก'
          });

          if (confirmed) {
            await firebaseService.deleteQuizResult(quiz.id, resId);
            renderScoresTable();
            refreshCb();
          }
        });
      });
    };

    renderScoresTable();

    modalEl.querySelector('#score-search-input')?.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderScoresTable();
    });

    modalEl.querySelector('#score-room-filter')?.addEventListener('change', (e) => {
      currentRoomFilter = e.target.value;
      renderScoresTable();
    });

    modalEl.querySelectorAll('#close-scores-modal, #close-scores-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }

  // Popup Prompt Modal Asking: 4 Options vs 5 Options before creating quiz
  showOptionTypePromptModal(onSelectType) {
    const modalHTML = `
      <div id="option-type-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white text-center space-y-5">
          <div class="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-2xl font-bold mx-auto">
            ✍️
          </div>

          <div class="space-y-1">
            <h3 class="text-xl font-bold text-slate-900 font-heading">เลือกประเภทแบบทดสอบ</h3>
            <p class="text-xs text-slate-500">กรุณาเลือกจำนวนตัวเลือกของแบบทดสอบที่ต้องการสร้าง</p>
          </div>

          <div class="grid grid-cols-2 gap-4 pt-2">
            <!-- 4 Options -->
            <button id="select-4-options" class="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/80 transition-all hover:scale-105 group text-left space-y-2">
              <div class="text-2xl font-bold text-indigo-600 group-hover:scale-110 transition-transform">4️⃣</div>
              <div class="font-bold font-heading text-slate-900 text-sm">แบบ 4 ตัวเลือก</div>
              <div class="text-[11px] text-slate-500 leading-tight">ตัวเลือก A, B, C, D (ก, ข, ค, ง)</div>
            </button>

            <!-- 5 Options -->
            <button id="select-5-options" class="p-5 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/80 transition-all hover:scale-105 group text-left space-y-2">
              <div class="text-2xl font-bold text-purple-600 group-hover:scale-110 transition-transform">5️⃣</div>
              <div class="font-bold font-heading text-slate-900 text-sm">แบบ 5 ตัวเลือก</div>
              <div class="text-[11px] text-slate-500 leading-tight">ตัวเลือก A, B, C, D, E (ก, ข, ค, ง, จ)</div>
            </button>
          </div>

          <div class="pt-2 border-t border-slate-100 flex justify-end">
            <button id="cancel-prompt-btn" class="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-medium">ยกเลิก</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('option-type-modal');

    modalEl.querySelector('#cancel-prompt-btn').addEventListener('click', () => modalEl.remove());

    modalEl.querySelector('#select-4-options').addEventListener('click', () => {
      modalEl.remove();
      onSelectType(4);
    });

    modalEl.querySelector('#select-5-options').addEventListener('click', () => {
      modalEl.remove();
      onSelectType(5);
    });
  }

  // Quiz Editor Modal (With question points, no explanation box, Target Rooms, and Question/Option Image Uploads)
  showQuizEditorModal(quiz, refreshCb, optionCountChoice = 4) {
    const isEdit = !!quiz;
    const courses = firebaseService.getCollection('courses');
    const users = firebaseService.getCollection('users');
    const studentUsers = users.filter(u => u.role === 'Student');

    const availableGrades = ['All', ...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))];
    if (availableGrades.length === 1) availableGrades.push('ม.1', 'ม.2', 'ม.3', 'ปวช.1', 'ปวช.2');

    const getRoomsForGrade = (targetGrade) => {
      let filtered = studentUsers;
      if (targetGrade !== 'All') {
        filtered = studentUsers.filter(s => s.grade === targetGrade);
      }
      const rooms = [...new Set(filtered.map(s => s.room).filter(r => r && r !== '-'))].sort();
      if (rooms.length === 0) rooms.push('1', '2', '3');
      return rooms;
    };

    const optionCount = isEdit ? (quiz.optionCount || (quiz.questions && quiz.questions[0] && quiz.questions[0].options ? quiz.questions[0].options.length : 4)) : optionCountChoice;
    
    const defaultOptions = optionCount === 5 
      ? ['A. ตัวเลือกที่ 1', 'B. ตัวเลือกที่ 2', 'C. ตัวเลือกที่ 3', 'D. ตัวเลือกที่ 4', 'E. ตัวเลือกที่ 5']
      : ['A. ตัวเลือกที่ 1', 'B. ตัวเลือกที่ 2', 'C. ตัวเลือกที่ 3', 'D. ตัวเลือกที่ 4'];

    let questions = isEdit && quiz.questions ? JSON.parse(JSON.stringify(quiz.questions)) : [
      {
        id: 'q1',
        questionText: 'ข้อใดคือคำตอบที่ถูกต้อง?',
        image: '',
        options: [...defaultOptions],
        optionImages: optionCount === 5 ? ['', '', '', '', ''] : ['', '', '', ''],
        correctAnswer: 0,
        points: 1
      }
    ];

    const modalHTML = `
      <div id="quiz-editor-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div id="quiz-modal-scroll" class="glass-card w-full max-w-3xl p-6 md:p-8 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span>${isEdit ? '✏️ แก้ไขแบบทดสอบ' : `➕ สร้างแบบทดสอบใหม่ (แบบ ${optionCount} ตัวเลือก)`}</span>
            </h3>
            <button id="close-quiz-editor" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="quiz-editor-form" class="space-y-6 mt-4">
            <!-- Quiz Info -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อชุดแบบทดสอบ <span class="text-rose-500">*</span></label>
                <input type="text" id="qz-title" value="${isEdit ? quiz.title : ''}" required class="input-field" placeholder="เช่น แบบทดสอบวิทยาศาสตร์ ม.1">
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">รายวิชา</label>
                <select id="qz-course" class="input-field">
                  ${courses.length > 0 ? courses.map(c => `<option value="${c.id}" ${isEdit && quiz.courseId === c.id ? 'selected' : ''}>${c.code || ''} - ${c.name}</option>`).join('') : '<option value="general">ทั่วไป</option>'}
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ระยะเวลาทำข้อสอบ (นาที)</label>
                <input type="number" id="qz-time" value="${isEdit ? (quiz.timeLimitMinutes || 5) : 5}" required min="1" class="input-field">
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">คำอธิบายข้อสอบ</label>
                <input type="text" id="qz-desc" value="${isEdit ? (quiz.description || '') : ''}" class="input-field" placeholder="ระบุเกณฑ์หรือคำแนะนำเพิ่มเติม...">
              </div>
            </div>

            <!-- Target Grade & Dynamic Multi-Room Checklist -->
            <div class="p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl space-y-3">
              <label class="block text-xs font-bold text-indigo-900">🎯 กำหนดกลุ่มนักเรียนที่ได้รับมอบหมาย (Target Class & Multi-Room)</label>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">ระดับชั้น</label>
                  <select id="qz-target-grade" class="input-field py-1 text-xs">
                    ${availableGrades.map(g => `
                      <option value="${g}" ${isEdit && quiz.targetGrade === g ? 'selected' : ''}>
                        ${g === 'All' ? '🌐 ทุกระดับชั้น (All Grades)' : g}
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-indigo-900 mb-1">เลือกห้องเรียน (ดึงเฉพาะห้องที่มีในระบบของระดับชั้นที่เลือก)</label>
                  <div id="qz-rooms-checklist" class="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1"></div>
                </div>
              </div>
              <p class="text-[11px] text-indigo-700 italic">* สามารถติ๊กเลือกหลายห้องพร้อมกันได้ นักเรียนห้องอื่นที่ไม่ได้ถูกเลือกจะไม่เห็นแบบทดสอบนี้</p>
            </div>

            <!-- Question Builder List -->
            <div class="space-y-4 pt-2 border-t border-slate-100">
              <div class="flex justify-between items-center">
                <h4 class="text-base font-bold font-heading text-slate-900">❓ รายการข้อสอบ (แบบ ${optionCount} ตัวเลือก)</h4>
                <button type="button" id="btn-add-question" class="btn-secondary text-xs px-3.5 py-1.5 rounded-xl font-heading font-semibold">
                  ➕ เพิ่มข้อสอบใหม่
                </button>
              </div>

              <div id="questions-container" class="space-y-6"></div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-quiz-editor-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium font-heading shadow-md">บันทึกแบบทดสอบ</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('quiz-editor-modal');
    const scrollContainer = modalEl.querySelector('#quiz-modal-scroll');
    const container = modalEl.querySelector('#questions-container');

    const gradeSelect = modalEl.querySelector('#qz-target-grade');
    const checklistContainer = modalEl.querySelector('#qz-rooms-checklist');

    const updateRoomChecklist = () => {
      const selectedGrade = gradeSelect ? gradeSelect.value : 'All';
      const rooms = getRoomsForGrade(selectedGrade);
      const currentSelectedRooms = isEdit && quiz.targetRooms ? quiz.targetRooms : ['All'];

      if (checklistContainer) {
        checklistContainer.innerHTML = `
          <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
            <input type="checkbox" name="qz_room_check" value="All" ${currentSelectedRooms.includes('All') ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
            <span>🌐 ทุกห้อง</span>
          </label>
          ${rooms.map(r => `
            <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
              <input type="checkbox" name="qz_room_check" value="${r}" ${currentSelectedRooms.includes(r) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
              <span>🏫 ห้อง ${r}</span>
            </label>
          `).join('')}
        `;
      }
    };

    updateRoomChecklist();
    if (gradeSelect) gradeSelect.addEventListener('change', updateRoomChecklist);

    const renderQuestions = () => {
      container.innerHTML = questions.map((q, idx) => `
        <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 relative">
          <div class="flex justify-between items-center border-b border-slate-200/60 pb-3">
            <div class="flex items-center gap-3">
              <span class="font-bold font-heading text-indigo-700 text-sm">ข้อที่ ${idx + 1}</span>
              
              <!-- Question Score Input (กำหนดคะแนน) -->
              <div class="flex items-center gap-1.5 bg-white px-3 py-1 rounded-xl border border-slate-200 text-xs">
                <span class="font-semibold text-slate-600">คะแนน:</span>
                <input type="number" min="1" value="${q.points || 1}" data-q-idx="${idx}" class="q-points-input w-14 font-mono font-bold text-center text-indigo-600 focus:outline-none">
                <span class="text-slate-500 font-normal">คะแนน</span>
              </div>
            </div>

            ${questions.length > 1 ? `<button type="button" data-remove-q="${idx}" class="text-rose-600 hover:text-rose-800 text-xs font-bold">🗑️ ลบข้อนี้</button>` : ''}
          </div>

          <!-- Question Text & Question Image Upload -->
          <div class="space-y-2">
            <label class="block text-xs font-semibold text-slate-700">โจทย์คำถาม <span class="text-rose-500">*</span></label>
            <input type="text" data-q-idx="${idx}" class="q-text-input input-field text-xs" value="${q.questionText || ''}" required placeholder="พิมพ์โจทย์คำถามที่นี่...">
            
            <!-- Image Attachment for Question -->
            <div class="flex items-center gap-3 pt-1">
              <label class="cursor-pointer bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-medium transition-colors">
                <span>🖼️ แนบรูปภาพโจทย์</span>
                <input type="file" accept="image/*" data-q-img-file="${idx}" class="hidden">
              </label>
              <input type="url" data-q-img-url="${idx}" class="q-img-url-input input-field py-1 text-xs" value="${q.image || ''}" placeholder="หรือวาง URL รูปภาพโจทย์...">
            </div>
            ${q.image ? `<div class="mt-2 max-w-xs rounded-xl overflow-hidden border border-slate-200 shadow-sm"><img src="${q.image}" class="w-full h-auto object-cover"></div>` : ''}
          </div>

          <!-- Options Grid (4 or 5 options with option images) -->
          <div class="space-y-2">
            <label class="block text-xs font-semibold text-slate-700">ตัวเลือก (เลือกปุ่มวิทยุสำหรับคำตอบที่ถูกต้อง)</label>
            <div class="space-y-3">
              ${(q.options || defaultOptions).map((opt, oIdx) => {
                const optImg = (q.optionImages && q.optionImages[oIdx]) || '';
                return `
                  <div class="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div class="flex items-center gap-2">
                      <input type="radio" name="correct_${idx}" value="${oIdx}" ${q.correctAnswer === oIdx ? 'checked' : ''} class="q-correct-radio w-4 h-4 text-indigo-600 shrink-0" data-q-idx="${idx}">
                      <input type="text" data-q-idx="${idx}" data-o-idx="${oIdx}" class="q-opt-input input-field py-1 text-xs" value="${opt}" required placeholder="ตัวเลือก ${oIdx + 1}">
                    </div>

                    <!-- Image Attachment for Option -->
                    <div class="flex items-center gap-2 pl-6">
                      <label class="cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                        <span>🖼️ รูปตัวเลือก</span>
                        <input type="file" accept="image/*" data-opt-img-file="${idx}_${oIdx}" class="hidden">
                      </label>
                      <input type="url" data-opt-img-url="${idx}_${oIdx}" class="opt-img-url-input input-field py-0.5 text-[11px]" value="${optImg}" placeholder="หรือวาง URL รูปภาพตัวเลือก...">
                    </div>
                    ${optImg ? `<div class="pl-6 max-w-xs rounded-lg overflow-hidden border border-slate-200"><img src="${optImg}" class="max-h-24 object-cover"></div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `).join('');

      // Bind dynamic remove & image file uploads
      container.querySelectorAll('[data-remove-q]').forEach(b => {
        b.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.dataset.removeQ, 10);
          questions.splice(idx, 1);
          renderQuestions();
        });
      });

      // Bind Question Image File Upload
      container.querySelectorAll('[data-q-img-file]').forEach(inp => {
        inp.addEventListener('change', (e) => {
          const idx = parseInt(e.currentTarget.dataset.qImgFile, 10);
          if (e.target.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              questions[idx].image = ev.target.result;
              renderQuestions();
            };
            reader.readAsDataURL(e.target.files[0]);
          }
        });
      });

      // Bind Option Image File Upload
      container.querySelectorAll('[data-opt-img-file]').forEach(inp => {
        inp.addEventListener('change', (e) => {
          const [qIdx, oIdx] = e.currentTarget.dataset.optImgFile.split('_').map(Number);
          if (e.target.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (!questions[qIdx].optionImages) questions[qIdx].optionImages = [];
              questions[qIdx].optionImages[oIdx] = ev.target.result;
              renderQuestions();
            };
            reader.readAsDataURL(e.target.files[0]);
          }
        });
      });
    };

    renderQuestions();

    modalEl.querySelector('#btn-add-question').addEventListener('click', () => {
      questions.push({
        id: `q_${Date.now()}`,
        questionText: '',
        image: '',
        options: [...defaultOptions],
        optionImages: optionCount === 5 ? ['', '', '', '', ''] : ['', '', '', ''],
        correctAnswer: 0,
        points: 1
      });
      renderQuestions();
    });

    modalEl.querySelectorAll('#close-quiz-editor, #close-quiz-editor-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#quiz-editor-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        const titleVal = (document.getElementById('qz-title')?.value || '').trim();
        if (!titleVal) {
          if (scrollContainer) scrollContainer.scrollTop = 0;
          await showAlertModal({ title: '⚠️ กรอกชื่อแบบทดสอบ', message: 'กรุณาระบุ "ชื่อชุดแบบทดสอบ" ก่อนบันทึก' });
          return;
        }

        // Collect updated questions values safely
        const updatedQuestions = questions.map((q, idx) => {
          const qTextEl = container.querySelector(`.q-text-input[data-q-idx="${idx}"]`);
          const qText = qTextEl ? qTextEl.value.trim() : (q.questionText || '');

          const pointsEl = container.querySelector(`.q-points-input[data-q-idx="${idx}"]`);
          const points = pointsEl ? (parseInt(pointsEl.value, 10) || 1) : (q.points || 1);

          const qImgUrlEl = container.querySelector(`.q-img-url-input[data-q-idx="${idx}"]`);
          const qImgUrl = qImgUrlEl ? qImgUrlEl.value.trim() : '';

          const radio = container.querySelector(`input[name="correct_${idx}"]:checked`);
          const correctAnswer = radio ? parseInt(radio.value, 10) : 0;

          const optInputs = container.querySelectorAll(`.q-opt-input[data-q-idx="${idx}"]`);
          const options = Array.from(optInputs).map(i => i.value.trim());

          const optionImages = options.map((_, oIdx) => {
            const inp = container.querySelector(`.opt-img-url-input[data-opt-img-url="${idx}_${oIdx}"]`);
            const urlVal = inp ? inp.value.trim() : '';
            return urlVal || (q.optionImages && q.optionImages[oIdx]) || '';
          });

          return {
            id: q.id || `q_${idx + 1}`,
            questionText: qText,
            image: qImgUrl || q.image || '',
            options: options.length > 0 ? options : defaultOptions,
            optionImages: optionImages,
            correctAnswer: correctAnswer,
            points: points
          };
        });

        const courseSelect = document.getElementById('qz-course');
        const courseId = courseSelect ? courseSelect.value : (courses[0] ? courses[0].id : 'general');
        const timeLimit = parseInt(document.getElementById('qz-time')?.value, 10) || 5;
        const description = (document.getElementById('qz-desc')?.value || '').trim();

        const checkboxes = modalEl.querySelectorAll('input[name="qz_room_check"]:checked');
        let selectedRooms = Array.from(checkboxes).map(cb => cb.value);
        if (selectedRooms.length === 0) selectedRooms = ['All'];

        const targetGrade = document.getElementById('qz-target-grade')?.value || 'All';

        const currentUser = this.rbac.getCurrentUser();
        const rawPayload = {
          title: titleVal,
          courseId: courseId,
          timeLimitMinutes: timeLimit,
          description: description,
          optionCount: optionCount,
          targetGrade: targetGrade,
          targetRooms: selectedRooms,
          creatorId: isEdit ? (quiz.creatorId || currentUser.id) : currentUser.id,
          creatorName: isEdit ? (quiz.creatorName || currentUser.name) : currentUser.name,
          isOpen: isEdit ? (quiz.isOpen !== false) : true,
          questions: updatedQuestions,
          results: (isEdit && quiz && Array.isArray(quiz.results)) ? quiz.results : []
        };

        // Deep Sanitize Payload (Prevents undefined fields from crashing Firebase set())
        const cleanPayload = this.sanitizeForFirebase(rawPayload);

        if (isEdit && quiz && quiz.id) {
          await firebaseService.updateItem('quizzes', quiz.id, cleanPayload);
        } else {
          await firebaseService.addItem('quizzes', cleanPayload);
        }

        modalEl.remove();

        await showAlertModal({
          title: '✨ บันทึกแบบทดสอบเรียบร้อย',
          message: `บันทึกชุดแบบทดสอบจำนวน ${updatedQuestions.length} ข้อ (${optionCount} ตัวเลือก) เรียบร้อยแล้ว`,
          type: 'success'
        });

        refreshCb();
      } catch (err) {
        console.error('Quiz save error:', err);
        await showAlertModal({
          title: '⚠️ เกิดข้อผิดพลาดในการบันทึก',
          message: `ไม่สามารถบันทึกแบบทดสอบได้: ${err.message || err}`,
          type: 'error'
        });
      }
    });
  }

  // Interactive Student Take Quiz Session
  startQuizSession(containerEl, quiz) {
    this.isSessionActive = true;
    const currentUser = this.rbac.getCurrentUser();
    const questions = quiz.questions || [];
    let secondsLeft = (quiz.timeLimitMinutes || 5) * 60;

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <!-- Sticky Timer Header -->
        <div class="glass-card p-5 rounded-3xl shadow-md bg-white border border-slate-200 sticky top-20 z-40 flex justify-between items-center">
          <div>
            <span class="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">กำลังทำแบบทดสอบ</span>
            <h2 class="text-lg font-bold font-heading text-slate-900 mt-1">${decodeMojibakeThai(quiz.title)}</h2>
          </div>

          <!-- Countdown Clock Badge -->
          <div class="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl font-mono font-bold text-sm shadow-md border border-slate-800">
            <span class="text-amber-400 animate-pulse">⏱️</span>
            <span id="quiz-countdown">00:00</span>
          </div>
        </div>

        <!-- Questions Card List -->
        <form id="take-quiz-form" class="space-y-6">
          ${questions.map((q, idx) => `
            <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3">
                  <span class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold font-heading flex items-center justify-center text-sm shrink-0 border border-indigo-100">
                    ${idx + 1}
                  </span>
                  <h3 class="text-base font-bold font-heading text-slate-900 pt-1 leading-relaxed">
                    ${decodeMojibakeThai(q.questionText)}
                  </h3>
                </div>
                <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 shrink-0">
                  ${q.points || 1} คะแนน
                </span>
              </div>

              <!-- Attached Question Image -->
              ${q.image ? `
                <div class="pl-0 sm:pl-11 max-w-md rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <img src="${q.image}" class="w-full h-auto object-cover">
                </div>
              ` : ''}

              <!-- Options List -->
              <div class="grid grid-cols-1 gap-3 pt-2 pl-0 sm:pl-11">
                ${(q.options || []).map((opt, oIdx) => {
                  const optImg = (q.optionImages && q.optionImages[oIdx]) || '';
                  return `
                    <label class="flex flex-col p-4 rounded-2xl border border-slate-200 cursor-pointer hover:bg-indigo-50/60 hover:border-indigo-300 transition-all text-xs text-slate-800 font-medium space-y-2">
                      <div class="flex items-center gap-3">
                        <input type="radio" name="answer_${idx}" value="${oIdx}" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                        <span class="font-semibold">${decodeMojibakeThai(opt)}</span>
                      </div>
                      ${optImg ? `<div class="pl-7 max-w-xs rounded-xl overflow-hidden border border-slate-200"><img src="${optImg}" class="max-h-32 object-cover"></div>` : ''}
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}

          <!-- Submit Button -->
          <div class="flex justify-end gap-4 pt-4">
            <button type="submit" class="btn-primary text-base px-8 py-3 rounded-2xl font-bold font-heading shadow-lg shadow-indigo-500/25">
              🎯 ส่งคำตอบเพื่อตรวจคะแนน
            </button>
          </div>
        </form>
      </div>
    `;

    // Timer Interval
    const updateCountdown = () => {
      const countdownEl = document.getElementById('quiz-countdown');
      if (!countdownEl) {
        clearInterval(this.quizTimer);
        return;
      }

      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      countdownEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (secondsLeft <= 60) {
        countdownEl.parentElement.classList.add('bg-rose-900', 'animate-pulse');
      }

      if (secondsLeft <= 0) {
        clearInterval(this.quizTimer);
        showAlertModal({ title: '⏱️ หมดเวลาทำข้อสอบ', message: 'ระบบได้ทำการส่งคำตอบให้อัตโนมัติ' });
        submitQuizAnswers();
      } else {
        secondsLeft--;
      }
    };

    updateCountdown();
    this.quizTimer = setInterval(updateCountdown, 1000);

    const submitQuizAnswers = () => {
      clearInterval(this.quizTimer);

      let score = 0;
      let maxScore = 0;
      const breakdown = [];

      questions.forEach((q, idx) => {
        const qPoints = parseInt(q.points, 10) || 1;
        maxScore += qPoints;

        const selectedRadio = containerEl.querySelector(`input[name="answer_${idx}"]:checked`);
        const selectedVal = selectedRadio ? parseInt(selectedRadio.value, 10) : -1;
        const isCorrect = selectedVal === q.correctAnswer;

        if (isCorrect) score += qPoints;

        breakdown.push({
          questionText: q.questionText,
          image: q.image,
          points: qPoints,
          selectedVal: selectedVal,
          correctAnswer: q.correctAnswer,
          options: q.options,
          optionImages: q.optionImages,
          isCorrect: isCorrect
        });
      });

      const stdId = (currentUser.studentId && currentUser.studentId !== '-') 
        ? currentUser.studentId 
        : (currentUser.username || currentUser.id || ('STD_' + Date.now()));

      const newResult = {
        id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        studentId: stdId,
        studentName: currentUser.name,
        score: score,
        maxScore: maxScore,
        completedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };

      firebaseService.addQuizResult(quiz.id, newResult);

      this.renderQuizResultSummary(containerEl, quiz, score, maxScore, breakdown);
    };

    containerEl.querySelector('#take-quiz-form').addEventListener('submit', (e) => {
      e.preventDefault();
      submitQuizAnswers();
    });
  }

  // Render Quiz Results Summary (Displays score summary without revealing answer key)
  renderQuizResultSummary(containerEl, quiz, score, maxScore) {
    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const isPassed = percent >= 50;

    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in max-w-2xl mx-auto py-8">
        <!-- Result Summary Card -->
        <div class="glass-card p-8 md:p-10 rounded-3xl shadow-xl bg-white border border-slate-200 text-center space-y-6">
          <div class="w-20 h-20 rounded-full ${isPassed ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-rose-100 text-rose-600 border border-rose-200'} mx-auto flex items-center justify-center text-4xl font-bold shadow-md">
            ${isPassed ? '🎉' : '⚠️'}
          </div>

          <div class="space-y-2">
            <span class="text-xs font-bold font-heading px-3.5 py-1.5 rounded-full ${isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
              ${isPassed ? '✅ ผ่านเกณฑ์การทดสอบ' : '⚠️ ควรทบทวนเนื้อหาเพิ่มเติม'}
            </span>
            <h2 class="text-2xl font-extrabold font-heading text-slate-900 mt-2">${decodeMojibakeThai(quiz.title)}</h2>
            <p class="text-xs text-slate-500">บันทึกผลการทำแบบทดสอบของคุณเรียบร้อยแล้ว</p>
          </div>

          <div class="py-6 px-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">คะแนนที่คุณทำได้</div>
            <div class="text-5xl font-extrabold font-heading ${isPassed ? 'text-emerald-600' : 'text-rose-600'}">
              ${score} / ${maxScore} <span class="text-lg font-normal text-slate-500">คะแนน (${percent}%)</span>
            </div>
          </div>

          <div class="pt-2">
            <button id="btn-back-to-quizzes" class="btn-primary text-sm px-8 py-3 rounded-2xl font-heading font-bold shadow-lg shadow-indigo-500/20">
              🔙 กลับสู่หน้าแบบทดสอบ
            </button>
          </div>
        </div>
      </div>
    `;

    containerEl.querySelector('#btn-back-to-quizzes')?.addEventListener('click', () => {
      this.isSessionActive = false;
      this.render(containerEl);
    });
  }
}
