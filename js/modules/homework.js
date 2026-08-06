/**
 * Courses & Homework Module
 * - Cloudinary CDN & Data URL Image Upload Service (Cloud Name: gibfwtj2).
 * - Firebase Realtime Database: 0.1s Live Sync across PC, iPad, iPhone, Android.
 * - Multi-Room Homework Assignment: Assign homework to multiple rooms simultaneously.
 * - Multi-Room Course Selection: Choose multiple taught rooms pulled from system users.
 * - Teacher Scope Control & Admin Full Control.
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showConfirmModal, showAlertModal, showImagePreviewModal } from '../services/dialogService.js';
import { uploadImageToCloudinary } from '../services/cloudinaryService.js';

export function parseYouTubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.trim().match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube-nocookie.com/embed/${match[2]}`;
  }
  return null;
}

export function getHwImages(hw) {
  if (!hw) return [];
  if (hw.attachmentImages && Array.isArray(hw.attachmentImages) && hw.attachmentImages.length > 0) {
    return hw.attachmentImages;
  }
  if (hw.attachmentImage) {
    return [hw.attachmentImage];
  }
  return [];
}

export function getHwYoutubeUrls(hw) {
  if (!hw) return [];
  if (hw.youtubeUrls && Array.isArray(hw.youtubeUrls) && hw.youtubeUrls.length > 0) {
    return hw.youtubeUrls.filter(url => url && parseYouTubeEmbedUrl(url));
  }
  if (hw.youtubeUrl && parseYouTubeEmbedUrl(hw.youtubeUrl)) {
    return [hw.youtubeUrl];
  }
  return [];
}

export class HomeworkModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedCourseId = 'All';

    // Listen for 0.1s Cloud Realtime Database updates from other devices
    window.addEventListener('ag_realtime_update', (e) => {
      if (e.detail && (e.detail.collection === 'homework' || e.detail.collection === 'courses')) {
        const activeContainer = document.getElementById('app-content');
        if (activeContainer && window.app && window.app.activeTab === 'homework') {
          this.render(activeContainer);
        }
      }
    });
  }

  render(containerEl) {
    const allCourses = firebaseService.getCollection('courses');
    const allHomework = firebaseService.getCollection('homework');
    const currentUser = this.rbac.getCurrentUser();

    // 1. Filter Courses based on Role, Teacher Responsibility, and Student Taught Rooms
    let visibleCourses = allCourses;

    if (currentUser.role === 'Teacher') {
      visibleCourses = allCourses.filter(c => decodeMojibakeThai(c.teacher) === decodeMojibakeThai(currentUser.name));
    } else if (currentUser.role === 'Student') {
      const stdClass = `${currentUser.grade || 'ม.1'}/${currentUser.room || '1'}`;
      visibleCourses = allCourses.filter(c => {
        if (!c.targetRooms || !Array.isArray(c.targetRooms) || c.targetRooms.length === 0 || c.targetRooms.includes('All')) {
          return true;
        }
        return c.targetRooms.includes(stdClass);
      });
    }

    // 2. Filter Homework based on Role, Teacher Responsibility, and Student Target Class/Rooms
    let visibleHomework = allHomework.filter(hw => {
      if (currentUser.role === 'Teacher') {
        const parentCourse = allCourses.find(c => c.id === hw.courseId);
        if (parentCourse && decodeMojibakeThai(parentCourse.teacher) !== decodeMojibakeThai(currentUser.name)) {
          return false;
        }
      }

      if (currentUser.role === 'Student') {
        const stdGrade = currentUser.grade || 'ม.1';
        const stdRoom = currentUser.room || '1';

        const hwGrade = hw.targetGrade || 'All';
        const hwRooms = hw.targetRooms || (hw.targetRoom ? [hw.targetRoom] : ['All']);

        if (hwGrade !== 'All' && hwGrade !== stdGrade) return false;
        if (!hwRooms.includes('All') && !hwRooms.includes(stdRoom)) return false;
      }

      if (this.selectedCourseId !== 'All' && hw.courseId !== this.selectedCourseId) return false;

      return true;
    });

    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in">
        <!-- Header -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200/80">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-3">
              <span class="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/80 text-xl">📚</span>
              จัดการรายวิชาและการบ้าน (Courses & Homework)
            </h2>
            <p class="text-slate-500 text-xs mt-1.5 leading-relaxed">
              ${currentUser.role === 'Teacher' 
                ? `แสดงเฉพาะรายวิชาและการบ้านที่คุณรับผิดชอบ (${decodeMojibakeThai(currentUser.name)})` 
                : currentUser.role === 'Admin'
                ? 'แสดงรายวิชาและการบ้านทั้งหมดในระบบ (Admin View)'
                : 'แสดงเฉพาะรายวิชาและการบ้านที่เปิดสอนในห้องเรียนของคุณ'}
            </p>
          </div>

          ${this.rbac.canManageHomework() ? `
            <div class="flex flex-wrap gap-3">
              <button id="btn-add-course" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-heading font-semibold flex items-center gap-1.5">
                <span>➕</span> สร้างรายวิชาใหม่
              </button>
              <button id="btn-add-hw" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-heading font-semibold shadow-md shadow-indigo-500/20 flex items-center gap-1.5">
                <span>📝</span> สั่งการบ้านใหม่
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Courses Cards Bar -->
        <div>
          <h3 class="text-xs font-bold text-slate-500 font-heading mb-3.5 uppercase tracking-wider flex items-center gap-2">
            <span>📖</span> รายวิชาที่เปิดสอน ${currentUser.role === 'Teacher' ? '(วิชาที่คุณรับผิดชอบ)' : ''}
          </h3>

          ${visibleCourses.length === 0 ? `
            <div class="glass-card p-8 text-center text-slate-400 rounded-3xl bg-white border border-slate-200">
              ${currentUser.role === 'Teacher' ? 'ยังไม่มีรายวิชาที่คุณเป็นผู้สอน สามารถกด "➕ สร้างรายวิชาใหม่" เพื่อเริ่มต้น' : 'ยังไม่มีรายวิชาในระบบ'}
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- All Courses Filter Card -->
              <div 
                data-course-id="All" 
                class="course-card p-5 rounded-2xl cursor-pointer border transition-all min-h-[135px] flex flex-col justify-between ${
                  this.selectedCourseId === 'All' 
                    ? 'ring-2 ring-indigo-500 bg-indigo-50/90 border-indigo-500 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80 shadow-sm'
                }"
              >
                <div>
                  <div class="font-bold text-slate-900 font-heading text-base leading-snug">ทุกรายวิชา</div>
                  <div class="text-xs text-indigo-600 font-semibold mt-1">${visibleHomework.length} การบ้านที่มองเห็น</div>
                </div>
                <div class="text-[11px] text-slate-400 mt-2 font-medium">รวมการบ้านจากทุกวิชาของคุณ</div>
              </div>

              <!-- Course Cards -->
              ${visibleCourses.map(c => {
                const taughtRoomsStr = (c.targetRooms && Array.isArray(c.targetRooms) && c.targetRooms.length > 0 && !c.targetRooms.includes('All'))
                  ? c.targetRooms.join(', ')
                  : 'ทุกห้อง';

                return `
                  <div 
                    data-course-id="${c.id}" 
                    class="course-card p-5 rounded-2xl cursor-pointer border transition-all min-h-[135px] flex flex-col justify-between relative group ${
                      this.selectedCourseId === c.id 
                        ? 'ring-2 ring-indigo-500 bg-indigo-50/90 border-indigo-500 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80 shadow-sm'
                    }"
                  >
                    <div>
                      <div class="flex justify-between items-center gap-2 mb-2">
                        <span class="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">${c.code}</span>
                        
                        <div class="flex items-center gap-1">
                          <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-600 border border-slate-200 shrink-0">${c.credits} หน่วยกิต</span>
                          
                          ${(currentUser.role === 'Admin' || (currentUser.role === 'Teacher' && decodeMojibakeThai(c.teacher) === decodeMojibakeThai(currentUser.name))) ? `
                            <button data-edit-course="${c.id}" class="text-indigo-600 hover:text-indigo-900 text-xs p-1 hover:bg-indigo-100 rounded-md transition-colors ml-1" title="แก้ไขวิชานี้">
                              ✏️
                            </button>
                            <button data-del-course="${c.id}" data-course-name="${decodeMojibakeThai(c.name)}" class="text-rose-600 hover:text-rose-900 text-xs p-1 hover:bg-rose-100 rounded-md transition-colors" title="ลบวิชานี้">
                              🗑️
                            </button>
                          ` : ''}
                        </div>
                      </div>

                      <div class="font-bold text-slate-900 font-heading text-base leading-snug">${decodeMojibakeThai(c.name)}</div>
                    </div>

                    <div class="space-y-1 mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <div class="font-medium flex items-center gap-1">
                        <span>🚪 ห้องที่สอน:</span> <span class="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/80 text-[11px]">${taughtRoomsStr}</span>
                      </div>
                      <div class="font-medium flex items-center gap-1 text-[11px]">
                        <span>👨‍🏫</span> <span>${decodeMojibakeThai(c.teacher)}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Homework List -->
        <div class="space-y-4">
          <h3 class="text-lg font-bold text-slate-900 font-heading flex items-center justify-between">
            <span>📋 รายการการบ้านที่มอบหมาย</span>
            <span class="text-xs font-normal text-slate-500">จำนวน ${visibleHomework.length} รายการ</span>
          </h3>

          ${visibleHomework.length === 0 ? `
            <div class="glass-card p-12 text-center text-slate-400 rounded-3xl bg-white border border-slate-200">
              ${currentUser.role === 'Student' ? 'ไม่มีการบ้านที่มอบหมายสำหรับห้องเรียนของคุณในขณะนี้' : 'ไม่พบรายการการบ้านในวิชานี้'}
            </div>
          ` : visibleHomework.map(hw => {
            const mySubmission = hw.submissions ? hw.submissions.find(s => s.studentId === currentUser.studentId) : null;
            const submissionCount = hw.submissions ? hw.submissions.length : 0;
            
            const targetGradeStr = hw.targetGrade && hw.targetGrade !== 'All' ? hw.targetGrade : 'ทุกชั้น';
            const hwRooms = hw.targetRooms || (hw.targetRoom ? [hw.targetRoom] : ['All']);
            const targetRoomsStr = (!hwRooms.includes('All')) ? `ห้อง ${hwRooms.join(', ')}` : 'ทุกห้อง';
            
            const targetBadgeText = (hw.targetGrade === 'All' && hwRooms.includes('All')) 
              ? '🌐 มอบหมายให้ทุกห้อง' 
              : `🎯 มอบหมายให้: ${targetGradeStr} (${targetRoomsStr})`;

            return `
              <div class="glass-card p-6 md:p-7 rounded-3xl shadow-sm space-y-4 bg-white border border-slate-200/90">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-3 py-1 rounded-xl font-bold font-heading">${hw.courseName}</span>
                      
                      <span class="bg-purple-50 text-purple-700 border border-purple-100 text-xs px-3 py-1 rounded-xl font-bold font-heading">
                        ${targetBadgeText}
                      </span>
                    </div>
                    
                    <h4 class="text-xl font-bold text-slate-900 font-heading mt-2.5 leading-snug">${decodeMojibakeThai(hw.title)}</h4>
                  </div>
                  <div class="text-right">
                    <div class="text-xs text-slate-500">กำหนดส่ง: <strong class="text-rose-600 font-mono font-bold">${hw.dueDate}</strong></div>
                    <div class="text-xs text-slate-500 mt-0.5">คะแนนเต็ม: <strong class="text-indigo-600 font-bold">${hw.maxPoints}</strong> คะแนน</div>
                  </div>
                </div>

                <p class="text-slate-700 text-sm leading-relaxed whitespace-pre-line">${decodeMojibakeThai(hw.detail)}</p>

                <!-- Attached Media (Images & YouTube Videos) -->
                ${(() => {
                  const hwImages = getHwImages(hw);
                  const ytUrls = getHwYoutubeUrls(hw);
                  if (hwImages.length === 0 && ytUrls.length === 0) return '';

                  return `
                    <div class="mt-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
                      ${hwImages.length > 0 ? `
                        <div>
                          <div class="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                            <span class="flex items-center gap-1.5">🖼️ ภาพประกอบโจทย์ (${hwImages.length} ภาพ):</span>
                            <span class="text-[11px] font-semibold text-indigo-600">🔍 คลิกรูปภาพเพื่อดูภาพขยาย</span>
                          </div>
                          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            ${hwImages.map((imgUrl, i) => `
                              <div class="aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-all bg-white group relative" data-preview-img="${imgUrl}">
                                <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                                <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 backdrop-blur-[1px]">
                                  <span>🔍</span> ภาพที่ ${i + 1}
                                </div>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}

                      ${ytUrls.length > 0 ? `
                        <div>
                          <div class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                            <span>🎥</span> วิดีโอประกอบการเรียนรู้ (${ytUrls.length} วิดีโอ):
                          </div>
                          <div class="${ytUrls.length === 1 ? 'max-w-2xl' : 'grid grid-cols-1 md:grid-cols-2'} gap-3">
                            ${ytUrls.map((url, i) => `
                              <div class="space-y-1">
                                ${ytUrls.length > 1 ? `<div class="text-[11px] font-bold text-rose-800">🎬 วิดีโอที่ ${i + 1}</div>` : ''}
                                <div class="rounded-xl overflow-hidden border border-slate-200 shadow-xs aspect-video bg-black">
                                  <iframe src="${parseYouTubeEmbedUrl(url)}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                                </div>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  `;
                })()}

                <!-- Actions / Status Area -->
                <div class="pt-3 flex flex-wrap justify-between items-center gap-4 border-t border-slate-100">
                  <div class="text-xs text-slate-500">
                    ส่งงานแล้ว: <strong class="text-slate-900 font-bold">${submissionCount}</strong> รายการ
                  </div>

                  <div class="flex items-center gap-3">
                    ${this.rbac.canSubmitHomework() && currentUser.role === 'Student' ? `
                      ${mySubmission ? `
                        <span class="px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                          mySubmission.status === 'Graded' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }">
                          ${mySubmission.status === 'Graded' ? `✅ ตรวจแล้ว (${mySubmission.score}/${hw.maxPoints} คะแนน)` : '⏳ ส่งงานแล้ว (รอตรวจ)'}
                        </span>
                        <button data-submit-hw="${hw.id}" class="btn-secondary text-xs px-3.5 py-1.5 rounded-xl font-heading font-semibold">แก้ไขงานที่ส่ง</button>
                      ` : `
                        <button data-submit-hw="${hw.id}" class="btn-primary text-xs px-4 py-2 rounded-xl font-heading font-bold shadow-md">📤 ส่งการบ้าน</button>
                      `}
                    ` : ''}

                    ${this.rbac.canManageHomework() ? `
                      <button data-grade-hw="${hw.id}" class="btn-primary text-xs px-4 py-2 rounded-xl font-heading font-bold">
                        🔍 ตรวจงานนักเรียน (${submissionCount})
                      </button>
                      <button data-edit-hw="${hw.id}" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-heading font-bold">
                        ✏️ แก้ไขการบ้าน
                      </button>
                      <button data-del-hw="${hw.id}" data-hw-title="${decodeMojibakeThai(hw.title)}" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all">ลบการบ้าน</button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bindings
    containerEl.querySelectorAll('[data-preview-img]').forEach(el => {
      el.addEventListener('click', (e) => {
        const src = e.currentTarget.dataset.previewImg;
        if (src) showImagePreviewModal(src);
      });
    });

    containerEl.querySelectorAll('.course-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit-course]') || e.target.closest('[data-del-course]')) return;
        this.selectedCourseId = e.currentTarget.dataset.courseId;
        this.render(containerEl);
      });
    });

    containerEl.querySelectorAll('[data-edit-course]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const courseId = e.currentTarget.dataset.editCourse;
        const targetCourse = allCourses.find(c => c.id === courseId);
        this.showCourseModal(targetCourse, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-del-course]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const courseId = e.currentTarget.dataset.delCourse;
        const courseName = e.currentTarget.dataset.courseName;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบรายวิชา',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบวิชา "${courseName}" ออกจากระบบ?`,
          confirmText: 'ลบรายวิชา',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('courses', courseId);
          if (this.selectedCourseId === courseId) this.selectedCourseId = 'All';
          this.render(containerEl);
        }
      });
    });

    containerEl.querySelector('#btn-add-course')?.addEventListener('click', () => this.showCourseModal(null, () => this.render(containerEl)));
    containerEl.querySelector('#btn-add-hw')?.addEventListener('click', () => this.showHomeworkModal(null, () => this.render(containerEl)));

    containerEl.querySelectorAll('[data-submit-hw]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hwId = e.currentTarget.dataset.submitHw;
        const hw = allHomework.find(h => h.id === hwId);
        this.showSubmissionModal(hw, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-edit-hw]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hwId = e.currentTarget.dataset.editHw;
        const hw = allHomework.find(h => h.id === hwId);
        this.showHomeworkModal(hw, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-grade-hw]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hwId = e.currentTarget.dataset.gradeHw;
        const hw = allHomework.find(h => h.id === hwId);
        this.showGradingModal(hw, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-del-hw]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const hwId = e.currentTarget.dataset.delHw;
        const hwTitle = e.currentTarget.dataset.hwTitle;

        const confirmed = await showConfirmModal({
          title: '📝 ยืนยันการลบการบ้าน',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบการบ้าน "${hwTitle}"? ข้อมูลการส่งงานของนักเรียนในหัวข้อนี้จะถูกลบออก`,
          confirmText: 'ลบการบ้าน',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('homework', hwId);
          this.render(containerEl);
        }
      });
    });
  }

  showCourseModal(targetCourse, refreshCb) {
    const isEdit = !!targetCourse;
    const users = firebaseService.getCollection('users');
    const currentUser = this.rbac.getCurrentUser();

    const teacherUsers = users.filter(u => u.role === 'Teacher' || u.role === 'Admin');
    const teacherNames = [...new Set(teacherUsers.map(t => decodeMojibakeThai(t.name)))];

    if (teacherNames.length === 0) {
      teacherNames.push('ครูประเสริฐ วิทยา', 'ครูวรรณา รักการอ่าน');
    }

    if (isEdit && targetCourse.teacher && !teacherNames.includes(decodeMojibakeThai(targetCourse.teacher))) {
      teacherNames.push(decodeMojibakeThai(targetCourse.teacher));
    }

    const studentUsers = users.filter(u => u.role === 'Student');
    const classRooms = [...new Set(studentUsers.map(s => `${s.grade}/${s.room}`).filter(r => r && !r.includes('-') && !r.includes('undefined')))].sort();

    if (classRooms.length === 0) {
      classRooms.push('ม.1/1', 'ม.1/2', 'ม.1/3', 'ม.2/1', 'ม.2/2');
    }

    const currentSelectedRooms = isEdit && targetCourse.targetRooms ? targetCourse.targetRooms : ['All'];

    const modalHTML = `
      <div id="crs-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-lg p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">
              ${isEdit ? '✏️ แก้ไขข้อมูลรายวิชา' : '➕ สร้างรายวิชาใหม่'}
            </h3>
            <button id="close-crs-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="crs-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">รหัสวิชา</label>
              <input type="text" id="crs-code" value="${isEdit ? targetCourse.code : ''}" required class="input-field font-mono" placeholder="เช่น ค21101">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ชื่อวิชา</label>
              <input type="text" id="crs-name" value="${isEdit ? targetCourse.name : ''}" required class="input-field" placeholder="เช่น คณิตศาสตร์พื้นฐาน ม.1">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ครูผู้สอน (เลือกจากผู้ใช้ในระบบ)</label>
              <select id="crs-teacher" class="input-field">
                ${teacherNames.map(name => `
                  <option value="${name}" ${isEdit && decodeMojibakeThai(targetCourse.teacher) === name ? 'selected' : (!isEdit && currentUser.role === 'Teacher' && decodeMojibakeThai(currentUser.name) === name ? 'selected' : '')}>
                    👨‍🏫 ${name}
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Multi-Room Selection Checklist -->
            <div class="p-4 bg-sky-50/70 border border-sky-200/80 rounded-2xl space-y-2.5">
              <label class="block text-xs font-bold text-sky-900">🚪 ระบุห้องเรียนที่สอน (ดึงเฉพาะห้องที่มีในระบบ)</label>
              
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-50">
                  <input type="checkbox" name="crs_room_check" value="All" ${currentSelectedRooms.includes('All') ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
                  <span>🌐 ทุกห้อง (All)</span>
                </label>

                ${classRooms.map(rm => `
                  <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-50">
                    <input type="checkbox" name="crs_room_check" value="${rm}" ${currentSelectedRooms.includes(rm) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
                    <span>🏫 ${rm}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">หน่วยกิต</label>
              <input type="number" step="0.5" id="crs-credits" value="${isEdit ? targetCourse.credits : 1.5}" required class="input-field">
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-crs-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2 rounded-xl text-sm font-medium font-heading">
                ${isEdit ? 'บันทึกการแก้ไข' : 'สร้างวิชา'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('crs-modal');

    modalEl.querySelectorAll('#close-crs-modal, #close-crs-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#crs-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const checkboxes = modalEl.querySelectorAll('input[name="crs_room_check"]:checked');
      let selectedRooms = Array.from(checkboxes).map(cb => cb.value);
      if (selectedRooms.length === 0) selectedRooms = ['All'];

      const payload = {
        code: document.getElementById('crs-code').value.trim(),
        name: document.getElementById('crs-name').value.trim(),
        teacher: document.getElementById('crs-teacher').value,
        targetRooms: selectedRooms,
        credits: parseFloat(document.getElementById('crs-credits').value),
        color: 'from-blue-600 to-indigo-600'
      };

      if (isEdit) {
        firebaseService.updateItem('courses', targetCourse.id, payload);
      } else {
        firebaseService.addItem('courses', payload);
      }

      modalEl.remove();

      await showAlertModal({
        title: '💾 บันทึกรายวิชาสำเร็จ',
        message: `${isEdit ? 'แก้ไข' : 'สร้าง'} รายวิชา "${payload.name}" เรียบร้อยแล้ว`,
        type: 'success'
      });

      refreshCb();
    });
  }

  showHomeworkModal(targetHw = null, refreshCb) {
    if (typeof targetHw === 'function') {
      refreshCb = targetHw;
      targetHw = null;
    }
    const isEdit = !!targetHw;

    const allCourses = firebaseService.getCollection('courses');
    const users = firebaseService.getCollection('users');
    const currentUser = this.rbac.getCurrentUser();

    let uploadedHwImages = isEdit 
      ? (targetHw.attachmentImages && Array.isArray(targetHw.attachmentImages) && targetHw.attachmentImages.length > 0 
          ? [...targetHw.attachmentImages] 
          : (targetHw.attachmentImage ? [targetHw.attachmentImage] : []))
      : [];

    let uploadedHwYtUrls = isEdit
      ? (targetHw.youtubeUrls && Array.isArray(targetHw.youtubeUrls) && targetHw.youtubeUrls.length > 0
          ? [...targetHw.youtubeUrls]
          : (targetHw.youtubeUrl ? [targetHw.youtubeUrl] : ['']))
      : [''];

    let availableCourses = allCourses;
    if (currentUser.role === 'Teacher') {
      availableCourses = allCourses.filter(c => decodeMojibakeThai(c.teacher) === decodeMojibakeThai(currentUser.name));
    }

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

    const modalHTML = `
      <div id="hw-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-lg p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">
              ${isEdit ? '✏️ แก้ไขข้อมูลการบ้าน' : '📝 สั่งการบ้านใหม่'}
            </h3>
            <button id="close-hw-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="hw-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">รายวิชา</label>
              <select id="hw-course" class="input-field">
                ${availableCourses.map(c => `
                  <option value="${c.id}" ${isEdit && targetHw.courseId === c.id ? 'selected' : (this.selectedCourseId === c.id ? 'selected' : '')}>
                    ${c.code} - ${c.name} (${c.teacher})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Target Grade & Dynamic Multi-Room Checklist -->
            <div class="p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl space-y-3">
              <label class="block text-xs font-bold text-indigo-900">🎯 กำหนดกลุ่มนักเรียนที่ได้รับมอบหมาย (Target Class & Multi-Room)</label>
              
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">ระดับชั้น</label>
                <select id="hw-target-grade" class="input-field py-1 text-xs">
                  ${availableGrades.map(g => `
                    <option value="${g}" ${isEdit && targetHw.targetGrade === g ? 'selected' : ''}>
                      ${g === 'All' ? '🌐 ทุกระดับชั้น (All Grades)' : g}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-indigo-900 mb-1">เลือกห้องเรียน (ดึงเฉพาะห้องที่มีในระบบของระดับชั้นที่เลือก)</label>
                <div id="hw-rooms-checklist" class="grid grid-cols-3 gap-2 pt-1"></div>
              </div>
              <p class="text-[11px] text-indigo-700 italic">* สามารถติ๊กเลือกหลายห้องพร้อมกันได้ นักเรียนห้องอื่นที่ไม่ได้ถูกเลือกจะไม่เห็นการบ้านนี้</p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">หัวข้อการบ้าน</label>
              <input type="text" id="hw-title" required class="input-field" value="${isEdit ? decodeMojibakeThai(targetHw.title) : ''}" placeholder="เช่น แบบฝึกหัดบทที่ 2 เรื่อง พีชคณิต">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">คำอธิบายและโจทย์</label>
              <textarea id="hw-detail" rows="4" required class="input-field" placeholder="ระบุรายละเอียดโจทย์ขั้นตอนการทำ...">${isEdit ? decodeMojibakeThai(targetHw.detail) : ''}</textarea>
            </div>

            <!-- Media Attachment 1: Multi-Image Upload (Cloudinary CDN) -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>🖼️</span> แนบภาพประกอบโจทย์ (เลือกแนบได้หลายภาพ)
                </label>
                <span id="hw-img-count-badge" class="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 ${uploadedHwImages.length > 0 ? '' : 'hidden'}">
                  แนบแล้ว ${uploadedHwImages.length} ภาพ
                </span>
              </div>
              
              <input type="file" id="hw-img-input" accept="image/*" multiple class="hidden">
              <div id="hw-img-dropzone" class="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/50 p-4 rounded-xl text-center cursor-pointer transition-all">
                <div class="text-2xl mb-1">📸</div>
                <div id="hw-img-text" class="text-xs font-bold text-indigo-900">
                  คลิกเพื่อเลือกไฟล์รูปภาพประกอบโจทย์ (เลือกพร้อมกันได้หลายภาพ)
                </div>
                <div id="hw-img-status" class="text-[11px] text-slate-500 mt-0.5">
                  รองรับไฟล์ภาพ JPG, PNG (อัปโหลดขึ้น Cloudinary CDN ความละเอียดสูง)
                </div>
              </div>

              <!-- Multi-Image Grid Preview Container -->
              <div id="hw-img-grid-container" class="${uploadedHwImages.length > 0 ? '' : 'hidden'} mt-3">
                <div id="hw-img-grid" class="grid grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
                  <!-- Dynamically filled with image thumbnails -->
                </div>
              </div>
            </div>

            <!-- Media Attachment 2: Multi-YouTube Video Links Manager -->
            <div class="p-4 bg-rose-50/60 border border-rose-100 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <span>🎥</span> แนบลิงก์วิดีโอประกอบการเรียนรู้ (YouTube Links)
                </label>
                <button type="button" id="btn-add-yt-row" class="text-xs font-bold text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-100 px-3 py-1 rounded-xl border border-rose-200 shadow-xs flex items-center gap-1 transition-all">
                  <span>➕</span> เพิ่มวิดีโออีกรายการ
                </button>
              </div>

              <div id="hw-yt-rows-container" class="space-y-3">
                <!-- Dynamic YouTube Input Rows populated by JS -->
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">กำหนดส่ง</label>
                <input type="date" id="hw-date" required class="input-field" value="${isEdit ? targetHw.dueDate : new Date().toISOString().substring(0, 10)}">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">คะแนนเต็ม</label>
                <input type="number" id="hw-pts" value="${isEdit ? targetHw.maxPoints : 20}" required class="input-field">
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-hw-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2 rounded-xl text-sm font-medium font-heading">
                ${isEdit ? 'บันทึกการแก้ไข' : 'สั่งการบ้าน'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('hw-modal');
    const gradeSelect = modalEl.querySelector('#hw-target-grade');
    const checklistContainer = modalEl.querySelector('#hw-rooms-checklist');

    const updateRoomChecklist = () => {
      const selectedGrade = gradeSelect.value;
      const rooms = getRoomsForGrade(selectedGrade);
      const currentSelectedRooms = isEdit && targetHw.targetRooms ? targetHw.targetRooms : ['All'];

      checklistContainer.innerHTML = `
        <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
          <input type="checkbox" name="hw_room_check" value="All" ${currentSelectedRooms.includes('All') ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
          <span>🌐 ทุกห้อง</span>
        </label>
        ${rooms.map(r => `
          <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
            <input type="checkbox" name="hw_room_check" value="${r}" ${currentSelectedRooms.includes(r) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
            <span>🏫 ห้อง ${r}</span>
          </label>
        `).join('')}
      `;
    };

    updateRoomChecklist();
    gradeSelect.addEventListener('change', updateRoomChecklist);

    // Multi-Image Upload Grid Handlers
    const imgInput = modalEl.querySelector('#hw-img-input');
    const dropzone = modalEl.querySelector('#hw-img-dropzone');
    const imgStatus = modalEl.querySelector('#hw-img-status');

    const updateImageGrid = () => {
      const gridContainer = modalEl.querySelector('#hw-img-grid-container');
      const grid = modalEl.querySelector('#hw-img-grid');
      const countBadge = modalEl.querySelector('#hw-img-count-badge');

      if (uploadedHwImages.length > 0) {
        gridContainer.classList.remove('hidden');
        countBadge.classList.remove('hidden');
        countBadge.textContent = `แนบแล้ว ${uploadedHwImages.length} ภาพ`;

        grid.innerHTML = uploadedHwImages.map((imgUrl, idx) => `
          <div class="relative group rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-white aspect-square">
            <img src="${imgUrl}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1 backdrop-blur-[1px]">
              <button type="button" data-zoom-idx="${idx}" class="p-1.5 bg-white/90 text-slate-800 rounded-lg text-xs hover:bg-white transition-colors" title="ดูรูปขนาดใหญ่">
                🔍
              </button>
              <button type="button" data-del-img-idx="${idx}" class="p-1.5 bg-rose-600/90 text-white rounded-lg text-xs hover:bg-rose-600 transition-colors" title="ลบรูปนี้ออก">
                🗑️
              </button>
            </div>
          </div>
        `).join('');

        grid.querySelectorAll('[data-del-img-idx]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.delImgIdx, 10);
            uploadedHwImages.splice(idx, 1);
            updateImageGrid();
          });
        });

        grid.querySelectorAll('[data-zoom-idx]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.zoomIdx, 10);
            showImagePreviewModal(uploadedHwImages[idx]);
          });
        });
      } else {
        gridContainer.classList.add('hidden');
        countBadge.classList.add('hidden');
        grid.innerHTML = '';
      }
    };

    updateImageGrid();

    dropzone.addEventListener('click', () => imgInput.click());

    imgInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          imgStatus.innerHTML = `⏳ กำลังอัปโหลดภาพที่ ${i + 1}/${files.length} (<strong>${file.name}</strong>)...`;
          try {
            const url = await uploadImageToCloudinary(file, 1200, 0.8);
            uploadedHwImages.push(url);
            updateImageGrid();
          } catch (err) {
            showAlertModal({ title: '⚠️ เกิดข้อผิดพลาด', message: `ไม่สามารถอัปโหลดไฟล์ "${file.name}" ได้` });
          }
        }
        imgStatus.innerHTML = `✅ อัปโหลดรวม ${uploadedHwImages.length} ภาพเรียบร้อยแล้ว`;
        imgInput.value = '';
      }
    });

    // Multi-YouTube Rows Dynamic Manager Handlers
    const updateYtRows = () => {
      const ytContainer = modalEl.querySelector('#hw-yt-rows-container');

      if (uploadedHwYtUrls.length === 0) {
        uploadedHwYtUrls.push('');
      }

      ytContainer.innerHTML = uploadedHwYtUrls.map((url, idx) => {
        const embedUrl = parseYouTubeEmbedUrl(url);
        return `
          <div class="p-3 bg-white rounded-xl border border-rose-100 space-y-2 shadow-xs relative" data-yt-row-idx="${idx}">
            <div class="flex items-center justify-between gap-2">
              <label class="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                <span>🎬</span> วิดีโอรายการที่ ${idx + 1}
              </label>
              ${uploadedHwYtUrls.length > 1 ? `
                <button type="button" data-del-yt-idx="${idx}" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-0.5 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1" title="ลบวิดีโอนี้ออก">
                  <span>🗑️</span> ลบออก
                </button>
              ` : ''}
            </div>

            <input 
              type="url" 
              data-yt-input-idx="${idx}" 
              class="input-field py-2 text-xs bg-slate-50/70 focus:bg-white" 
              value="${url}" 
              placeholder="วางลิงก์ YouTube เช่น https://www.youtube.com/watch?v=... หรือ https://youtu.be/..."
            >

            <!-- Live Embed Preview for this Row -->
            <div class="${embedUrl ? '' : 'hidden'} mt-2 rounded-xl overflow-hidden border border-rose-200 aspect-video bg-black shadow-xs">
              <iframe src="${embedUrl || ''}" class="w-full h-full border-0" allowfullscreen></iframe>
            </div>
          </div>
        `;
      }).join('');

      ytContainer.querySelectorAll('[data-yt-input-idx]').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = parseInt(e.currentTarget.dataset.ytInputIdx, 10);
          uploadedHwYtUrls[idx] = e.target.value.trim();
          const rowEl = ytContainer.querySelector(`[data-yt-row-idx="${idx}"]`);
          const iframeBox = rowEl ? rowEl.querySelector('.aspect-video') : null;
          const iframe = rowEl ? rowEl.querySelector('iframe') : null;
          const embed = parseYouTubeEmbedUrl(e.target.value.trim());

          if (embed && iframeBox && iframe) {
            iframe.src = embed;
            iframeBox.classList.remove('hidden');
          } else if (iframeBox && iframe) {
            iframe.src = '';
            iframeBox.classList.add('hidden');
          }
        });
      });

      ytContainer.querySelectorAll('[data-del-yt-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.dataset.delYtIdx, 10);
          uploadedHwYtUrls.splice(idx, 1);
          updateYtRows();
        });
      });
    };

    updateYtRows();

    modalEl.querySelector('#btn-add-yt-row')?.addEventListener('click', () => {
      uploadedHwYtUrls.push('');
      updateYtRows();
      const lastInput = modalEl.querySelector(`[data-yt-input-idx="${uploadedHwYtUrls.length - 1}"]`);
      if (lastInput) lastInput.focus();
    });

    modalEl.querySelectorAll('#close-hw-modal, #close-hw-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#hw-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const courseId = document.getElementById('hw-course').value;
      const targetCourse = allCourses.find(c => c.id === courseId);

      const checkboxes = modalEl.querySelectorAll('input[name="hw_room_check"]:checked');
      let selectedRooms = Array.from(checkboxes).map(cb => cb.value);
      if (selectedRooms.length === 0) selectedRooms = ['All'];

      const validYtUrls = uploadedHwYtUrls.map(u => u.trim()).filter(u => u && parseYouTubeEmbedUrl(u));

      if (isEdit) {
        const updates = {
          courseId: courseId,
          courseName: targetCourse ? targetCourse.name : (targetHw.courseName || ''),
          title: document.getElementById('hw-title').value.trim(),
          detail: document.getElementById('hw-detail').value.trim(),
          dueDate: document.getElementById('hw-date').value,
          maxPoints: parseInt(document.getElementById('hw-pts').value, 10),
          targetGrade: document.getElementById('hw-target-grade').value,
          targetRooms: selectedRooms,
          attachmentImages: [...uploadedHwImages],
          attachmentImage: uploadedHwImages.length > 0 ? uploadedHwImages[0] : '',
          youtubeUrls: validYtUrls,
          youtubeUrl: validYtUrls.length > 0 ? validYtUrls[0] : ''
        };
        firebaseService.updateItem('homework', targetHw.id, updates);
      } else {
        const payload = {
          courseId: courseId,
          courseName: targetCourse ? targetCourse.name : '',
          title: document.getElementById('hw-title').value.trim(),
          detail: document.getElementById('hw-detail').value.trim(),
          dueDate: document.getElementById('hw-date').value,
          maxPoints: parseInt(document.getElementById('hw-pts').value, 10),
          targetGrade: document.getElementById('hw-target-grade').value,
          targetRooms: selectedRooms,
          attachmentImages: [...uploadedHwImages],
          attachmentImage: uploadedHwImages.length > 0 ? uploadedHwImages[0] : '',
          youtubeUrls: validYtUrls,
          youtubeUrl: validYtUrls.length > 0 ? validYtUrls[0] : '',
          submissions: []
        };
        firebaseService.addItem('homework', payload);
      }
      modalEl.remove();
      refreshCb();
    });
  }

  // Student Homework Submission Modal with Cloudinary CDN Upload (Cloud Name: gibfwtj2) + Data URL Fallback
  showSubmissionModal(hw, refreshCb) {
    const currentUser = this.rbac.getCurrentUser();
    const existing = hw.submissions ? hw.submissions.find(s => s.studentId === currentUser.studentId) : null;
    let uploadedImageUrl = existing ? (existing.imageFile || '') : '';

    const modalHTML = `
      <div id="sub-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-lg p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">📤 ส่งการบ้าน</h3>
            <button id="close-sub-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <!-- Homework Problem & Instructions Info Card -->
          <div class="mt-4 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100/90 space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full font-heading">
                📚 ${decodeMojibakeThai(hw.courseName || 'ทั่วไป')}
              </span>
              <div class="flex items-center gap-3 text-[11px] text-slate-600 font-heading">
                <span>📅 กำหนดส่ง: <strong class="text-indigo-900 font-bold">${hw.dueDate || 'ไม่ระบุ'}</strong></span>
                <span>💯 คะแนนเต็ม: <strong class="text-emerald-700 font-bold">${hw.maxPoints || 20} คะแนน</strong></span>
              </div>
            </div>

            <div>
              <h4 class="font-extrabold text-slate-900 font-heading text-sm flex items-center gap-1.5">
                <span>📌 โจทย์/หัวข้อการบ้าน:</span> ${decodeMojibakeThai(hw.title)}
              </h4>
              <div class="text-xs text-slate-700 leading-relaxed mt-1.5 whitespace-pre-line bg-white/90 p-3 rounded-xl border border-indigo-100 shadow-sm space-y-3">
                <div>${decodeMojibakeThai(hw.detail || 'ไม่มีรายละเอียดเพิ่มเติม')}</div>

                ${(() => {
                  const subHwImages = getHwImages(hw);
                  if (subHwImages.length === 0) return '';
                  return `
                    <div class="pt-2.5 border-t border-indigo-100/70">
                      <div class="text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                        <span class="flex items-center gap-1">🖼️ ภาพประกอบโจทย์ (${subHwImages.length} ภาพ):</span>
                        <span class="text-[11px] font-semibold text-indigo-600">🔍 คลิกรูปเพื่อขยาย</span>
                      </div>
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        ${subHwImages.map((imgUrl, i) => `
                          <div class="aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-all bg-white group relative" data-preview-img="${imgUrl}">
                            <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                            <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                              <span>🔍</span> ภาพที่ ${i + 1}
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `;
                })()}

                ${(() => {
                  const subYtUrls = getHwYoutubeUrls(hw);
                  if (subYtUrls.length === 0) return '';
                  return `
                    <div class="pt-2.5 border-t border-indigo-100/70">
                      <div class="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                        <span>🎥</span> วิดีโอประกอบการเรียนรู้ (${subYtUrls.length} วิดีโอ):
                      </div>
                      <div class="space-y-2.5">
                        ${subYtUrls.map((url, i) => `
                          <div class="space-y-1">
                            ${subYtUrls.length > 1 ? `<div class="text-[11px] font-bold text-rose-800">🎬 วิดีโอที่ ${i + 1}</div>` : ''}
                            <div class="w-full rounded-xl overflow-hidden border border-slate-200 shadow-xs aspect-video bg-black">
                              <iframe src="${parseYouTubeEmbedUrl(url)}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `;
                })()}
              </div>
            </div>
          </div>

          <form id="sub-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ข้อความคำตอบ / รายละเอียดส่งงาน</label>
              <textarea id="sub-text" rows="3" required class="input-field" placeholder="พิมพ์คำตอบหรืออธิบายรายละเอียดงานที่ส่ง...">${existing ? existing.textResponse : ''}</textarea>
            </div>

            <!-- Cloudinary CDN Image Upload Dropzone -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">🖼️ แนบไฟล์ภาพชิ้นงาน (Cloudinary CDN gibfwtj2 & Data URL)</label>
              
              <input type="file" id="sub-img-input" accept="image/*" class="hidden">
              <div id="sub-img-dropzone" class="border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 p-5 rounded-2xl text-center cursor-pointer transition-all">
                <div class="text-3xl mb-1">📸</div>
                <div id="sub-img-text" class="text-xs font-heading font-bold text-sky-800">
                  คลิกเพื่อถ่ายรูปหรือเลือกรูปภาพงานจากคอมพิวเตอร์ของคุณ
                </div>
                <div id="sub-img-status" class="text-[11px] text-slate-500 mt-1">
                  จัดเก็บไฟล์รูปบน Cloudinary CDN (gibfwtj2) ความละเอียดสูง คมชัดทุกอุปกรณ์ ☁️
                </div>
              </div>

              <!-- Compressed & CDN Image Live Preview Container -->
              <div id="sub-img-preview-box" class="${uploadedImageUrl ? '' : 'hidden'} mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center relative group">
                <div class="text-xs font-bold text-emerald-600 mb-2 flex items-center justify-center gap-1">
                  <span>✅</span> พร้อมส่งรูปภาพนี้ (อัปโหลดขึ้น CDN สำเร็จ)
                </div>
                <div class="max-h-48 rounded-xl overflow-hidden shadow-sm inline-block border border-slate-200">
                  <img id="sub-img-preview" src="${uploadedImageUrl}" class="max-h-48 w-auto object-contain">
                </div>
                <button type="button" id="btn-remove-sub-img" class="mt-2 text-rose-600 hover:text-rose-800 text-xs font-bold block mx-auto underline">
                  🗑️ เปลี่ยนรูปภาพใหม่
                </button>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-sub-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" id="btn-submit-hw-now" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium font-heading shadow-md">ส่งงานทันที</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('sub-modal');
    const fileInput = modalEl.querySelector('#sub-img-input');
    const dropzone = modalEl.querySelector('#sub-img-dropzone');
    const statusText = modalEl.querySelector('#sub-img-status');
    const previewBox = modalEl.querySelector('#sub-img-preview-box');
    const previewImg = modalEl.querySelector('#sub-img-preview');
    const removeBtn = modalEl.querySelector('#btn-remove-sub-img');

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        statusText.innerHTML = `⏳ กำลังอัปโหลดภาพ <strong>${file.name}</strong> ขึ้น Cloudinary CDN (gibfwtj2)...`;
        
        try {
          uploadedImageUrl = await uploadImageToCloudinary(file, 1200, 0.8);
          previewImg.src = uploadedImageUrl;
          previewBox.classList.remove('hidden');
          statusText.innerHTML = `✅ อัปโหลดรูปภาพขึ้น Cloudinary CDN (gibfwtj2) สำเร็จ!`;
        } catch (err) {
          showAlertModal({ title: '⚠️ เกิดข้อผิดพลาด', message: 'ไม่สามารถประมวลผลไฟล์ภาพที่เลือกได้' });
          statusText.innerHTML = `❌ เกิดข้อผิดพลาดในการประมวลผลรูปภาพ`;
        }
      }
    });

    removeBtn.addEventListener('click', () => {
      uploadedImageUrl = '';
      fileInput.value = '';
      previewImg.src = '';
      previewBox.classList.add('hidden');
      statusText.innerHTML = `จัดเก็บไฟล์รูปบน Cloudinary CDN (gibfwtj2) ความละเอียดสูง คมชัดทุกอุปกรณ์ ☁️`;
    });

    modalEl.querySelectorAll('#close-sub-modal, #close-sub-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#sub-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Always fetch fresh homework item directly from Firebase DB cache to prevent race condition data overwrite
      const allHw = firebaseService.getCollection('homework');
      const currentHw = allHw.find(h => h.id === hw.id) || hw;
      const submissions = Array.isArray(currentHw.submissions) ? [...currentHw.submissions] : [];

      const index = submissions.findIndex(s => s.studentId === currentUser.studentId);

      const newSub = {
        studentId: currentUser.studentId || 'STD6701',
        studentName: currentUser.name,
        submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        textResponse: document.getElementById('sub-text').value.trim(),
        imageFile: uploadedImageUrl,
        score: index !== -1 ? submissions[index].score : null,
        feedback: index !== -1 ? submissions[index].feedback : '',
        status: index !== -1 ? submissions[index].status : 'Pending'
      };

      if (index !== -1) {
        submissions[index] = newSub;
      } else {
        submissions.push(newSub);
      }

      await firebaseService.updateItem('homework', hw.id, { submissions });
      modalEl.remove();
      refreshCb();
    });
  }

  showGradingModal(hw, refreshCb) {
    const allHw = firebaseService.getCollection('homework');
    const freshHw = allHw.find(h => h.id === hw.id) || hw;
    const initialSubs = Array.isArray(freshHw.submissions) ? freshHw.submissions : [];

    let currentFilterStatus = 'ALL'; // 'ALL' | 'Pending' | 'Graded'
    let currentSearchText = '';

    // Expanded Accordion State Set (Default: COLLAPSED ALL)
    const expandedStudentIds = new Set();

    const modalHTML = `
      <div id="grade-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-4xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[92vh] flex flex-col space-y-4 font-sarabun">
          
          <!-- Modal Header -->
          <div class="flex flex-wrap justify-between items-center pb-3 border-b border-slate-100 shrink-0 gap-2 font-sarabun">
            <div>
              <h3 class="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
                <span>🔍 ตรวจงานนักเรียน:</span> ${decodeMojibakeThai(freshHw.title)}
              </h3>
              <p class="text-xs text-slate-500 font-sarabun mt-0.5">
                คะแนนเต็ม: <strong class="text-indigo-600 font-bold">${freshHw.maxPoints} คะแนน</strong> | 
                ส่งงานทั้งหมด: <strong class="text-emerald-700 font-bold" id="header-sub-count">${initialSubs.length} คน</strong>
              </p>
            </div>
            <button id="close-grade-modal-x" class="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">✕</button>
          </div>

          <!-- Search & Filter Controls Toolbar -->
          ${initialSubs.length > 0 ? `
            <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 shrink-0 font-sarabun">
              <div class="flex items-center gap-2 flex-1 max-w-md">
                <input type="text" id="grade-search-input" class="input-field py-1.5 text-xs bg-white font-sarabun" placeholder="🔍 ค้นหาชื่อนักเรียน หรือ รหัสนักเรียน...">
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs font-bold font-sarabun">
                <span class="text-slate-500">กรองสถานะ:</span>
                <button type="button" data-grade-filter="ALL" class="px-2.5 py-1 rounded-lg border text-xs transition-all bg-indigo-600 text-white border-indigo-600">
                  ทั้งหมด (${initialSubs.length})
                </button>
                <button type="button" data-grade-filter="Pending" class="px-2.5 py-1 rounded-lg border text-xs transition-all bg-amber-50 text-amber-800 border-amber-200">
                  ⏳ รอตรวจ (${initialSubs.filter(s => s.status !== 'Graded').length})
                </button>
                <button type="button" data-grade-filter="Graded" class="px-2.5 py-1 rounded-lg border text-xs transition-all bg-emerald-50 text-emerald-800 border-emerald-200">
                  ✅ ตรวจแล้ว (${initialSubs.filter(s => s.status === 'Graded').length})
                </button>

                <div class="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                <!-- Global Expand/Collapse Accordion Controls -->
                <button type="button" id="btn-expand-all" class="px-2.5 py-1 rounded-lg border text-xs transition-all bg-white hover:bg-slate-100 text-slate-700 border-slate-200">
                  ▼ ขยายทั้งหมด
                </button>
                <button type="button" id="btn-collapse-all" class="px-2.5 py-1 rounded-lg border text-xs transition-all bg-white hover:bg-slate-100 text-slate-700 border-slate-200">
                  ▲ หดทั้งหมด
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Scrollable Submissions List Container -->
          <div id="grade-submissions-list" class="flex-1 overflow-y-auto space-y-3 pr-1 font-sarabun max-h-[62vh]">
            <!-- Dynamically populated Compact Accordion List -->
          </div>

          <!-- Modal Footer -->
          <div class="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3 shrink-0 font-sarabun">
            <div class="text-xs text-slate-500 font-sarabun font-medium">
              แสดงรายการส่งงาน <strong id="grade-count-text" class="text-slate-900 font-bold">${initialSubs.length}</strong> ชิ้นงาน
            </div>
            <div class="flex items-center gap-3">
              <button id="close-grade-cancel-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold font-sarabun">ยกเลิก</button>
              <button id="close-grade-btn" class="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold font-heading shadow-md shadow-indigo-500/20">
                💾 บันทึกการตรวจงานทั้งหมด
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('grade-modal');
    const listContainer = modalEl.querySelector('#grade-submissions-list');
    const searchInput = modalEl.querySelector('#grade-search-input');
    const headerSubCount = modalEl.querySelector('#header-sub-count');

    const renderSubmissionsList = () => {
      const latestAllHw = firebaseService.getCollection('homework');
      const latestHw = latestAllHw.find(h => h.id === hw.id) || hw;
      const latestSubs = Array.isArray(latestHw.submissions) ? latestHw.submissions : [];

      if (headerSubCount) headerSubCount.textContent = `${latestSubs.length} คน`;

      let filtered = latestSubs;

      if (currentFilterStatus === 'Pending') {
        filtered = filtered.filter(s => s.status !== 'Graded');
      } else if (currentFilterStatus === 'Graded') {
        filtered = filtered.filter(s => s.status === 'Graded');
      }

      if (currentSearchText.trim()) {
        const q = currentSearchText.trim().toLowerCase();
        filtered = filtered.filter(s => 
          decodeMojibakeThai(s.studentName).toLowerCase().includes(q) || 
          (s.studentId && s.studentId.toLowerCase().includes(q))
        );
      }

      const countText = modalEl.querySelector('#grade-count-text');
      if (countText) countText.textContent = `${filtered.length}/${latestSubs.length}`;

      if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-12 text-slate-400 font-sarabun">ไม่พบรายการส่งงานของนักเรียนตามเงื่อนไขที่เลือก</div>`;
        return;
      }

      listContainer.innerHTML = filtered.map((sub) => {
        const isExpanded = expandedStudentIds.has(sub.studentId);
        return `
          <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs font-sarabun transition-all duration-200 hover:border-slate-300" data-sub-card="${sub.studentId}">
            <!-- Compact Header Row (Click to toggle expand/collapse) -->
            <div class="p-3.5 bg-slate-50 hover:bg-slate-100/90 cursor-pointer flex items-center justify-between gap-3 select-none font-sarabun" data-accordion-toggle="${sub.studentId}">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-slate-400 font-bold transition-transform duration-200 text-xs ${isExpanded ? 'rotate-90 text-indigo-600' : ''}">
                  ▶
                </span>
                <div class="font-bold text-slate-900 font-heading text-sm truncate flex items-center gap-2">
                  <span>👤 ${decodeMojibakeThai(sub.studentName)}</span>
                  <span class="font-mono text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">${sub.studentId}</span>
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <!-- Status Badge -->
                ${sub.status === 'Graded' ? `
                  <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    ✅ ตรวจแล้ว (${sub.score}/${latestHw.maxPoints})
                  </span>
                ` : `
                  <span class="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    ⏳ รอตรวจ
                  </span>
                `}

                <div class="text-xs text-slate-500 font-mono hidden sm:block">📅 ${sub.submittedAt}</div>

                <!-- Delete Button -->
                <button type="button" data-del-sub="${sub.studentId}" data-student-name="${decodeMojibakeThai(sub.studentName)}" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-all flex items-center gap-1 font-sarabun" title="ลบงานชิ้นนี้">
                  <span>🗑️</span>
                </button>
              </div>
            </div>

            <!-- Expandable Content Body -->
            <div class="p-4 space-y-3 bg-white border-t border-slate-100 ${isExpanded ? '' : 'hidden'}" data-accordion-body="${sub.studentId}">
              <!-- Student Response Text & Image -->
              <div class="text-xs text-slate-700 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                <div><strong>💬 ข้อความคำตอบ:</strong> ${decodeMojibakeThai(sub.textResponse || 'ไม่มีข้อความ')}</div>
                
                ${sub.imageFile ? `
                  <div class="pt-2 border-t border-slate-200/60">
                    <div class="font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span class="flex items-center gap-1">🖼️ รูปภาพชิ้นงานที่ส่ง (Cloudinary CDN):</span>
                      <span class="text-[11px] font-semibold text-indigo-600">🔍 คลิกรูปเพื่อดูรูปใหญ่</span>
                    </div>
                    <div class="max-w-md rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900/5 relative group cursor-pointer" data-preview-img="${sub.imageFile}" data-student-name="${decodeMojibakeThai(sub.studentName)}">
                      <img src="${sub.imageFile}" class="w-full max-h-64 object-contain group-hover:scale-105 transition-transform">
                      <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[2px]">
                        <span class="text-base">🔍</span> คลิกเพื่อเปิดรูปภาพขนาดใหญ่
                      </div>
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- Score & Feedback Inputs -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">ให้คะแนน (เต็ม ${latestHw.maxPoints} คะแนน):</label>
                  <input type="number" max="${latestHw.maxPoints}" min="0" data-student-id="${sub.studentId}" class="sub-score-input input-field py-1.5 text-xs bg-white font-bold text-indigo-900 font-sarabun" value="${sub.score !== null && sub.score !== undefined ? sub.score : ''}" placeholder="ระบุคะแนน">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">คำแนะนำ / ความเห็นครู:</label>
                  <input type="text" data-student-id="${sub.studentId}" class="sub-feedback-input input-field py-1.5 text-xs bg-white font-sarabun" value="${sub.feedback || ''}" placeholder="เช่น ทำได้เยี่ยมมาก!">
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Accordion Toggle Event Handlers
      listContainer.querySelectorAll('[data-accordion-toggle]').forEach(header => {
        header.addEventListener('click', (e) => {
          // If clicked delete button, don't toggle accordion
          if (e.target.closest('[data-del-sub]')) return;

          const stdId = header.dataset.accordionToggle;
          if (expandedStudentIds.has(stdId)) {
            expandedStudentIds.delete(stdId);
          } else {
            expandedStudentIds.add(stdId);
          }
          renderSubmissionsList();
        });
      });

      // Re-bind image preview lightbox
      listContainer.querySelectorAll('[data-preview-img]').forEach(box => {
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          const imgUrl = e.currentTarget.dataset.previewImg;
          const stdName = e.currentTarget.dataset.studentName;
          showImagePreviewModal({
            imageUrl: imgUrl,
            title: `🖼️ รูปภาพงานส่งของนักเรียน`,
            studentName: stdName
          });
        });
      });

      // Re-bind delete submission
      listContainer.querySelectorAll('[data-del-sub]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const stdId = e.currentTarget.dataset.delSub;
          const stdName = e.currentTarget.dataset.studentName || 'นักเรียน';

          const confirmed = await showConfirmModal({
            title: '🗑️ ยืนยันการลบการส่งงาน',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบชิ้นงานการบ้านที่ส่งของ "${decodeMojibakeThai(stdName)}"? หลังจากลบแล้วนักเรียนจะสามารถเข้าส่งงานใหม่อีกครั้งได้`,
            confirmText: 'ลบการส่งงาน',
            cancelText: 'ยกเลิก'
          });

          if (confirmed) {
            const currentAllHw = firebaseService.getCollection('homework');
            const currentHwObj = currentAllHw.find(h => h.id === hw.id) || hw;
            
            let currentSubs = Array.isArray(currentHwObj.submissions) ? [...currentHwObj.submissions] : [];
            currentSubs = currentSubs.filter(s => s.studentId !== stdId);

            currentHwObj.submissions = currentSubs;
            hw.submissions = currentSubs;

            await firebaseService.updateItem('homework', hw.id, { submissions: currentSubs });
            renderSubmissionsList();
            refreshCb();
          }
        });
      });
    };

    renderSubmissionsList();

    // Bind Search Input Filter
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchText = e.target.value;
        renderSubmissionsList();
      });
    }

    // Bind Filter Status Buttons
    modalEl.querySelectorAll('[data-grade-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentFilterStatus = e.currentTarget.dataset.gradeFilter;
        modalEl.querySelectorAll('[data-grade-filter]').forEach(b => {
          b.className = 'px-2.5 py-1 rounded-lg border text-xs transition-all bg-slate-100 text-slate-700 border-slate-200';
        });
        if (currentFilterStatus === 'ALL') e.currentTarget.className = 'px-2.5 py-1 rounded-lg border text-xs transition-all bg-indigo-600 text-white border-indigo-600';
        else if (currentFilterStatus === 'Pending') e.currentTarget.className = 'px-2.5 py-1 rounded-lg border text-xs transition-all bg-amber-500 text-white border-amber-500';
        else if (currentFilterStatus === 'Graded') e.currentTarget.className = 'px-2.5 py-1 rounded-lg border text-xs transition-all bg-emerald-600 text-white border-emerald-600';

        renderSubmissionsList();
      });
    });

    // Global Expand All & Collapse All Controls
    modalEl.querySelector('#btn-expand-all')?.addEventListener('click', () => {
      const latestAllHw = firebaseService.getCollection('homework');
      const latestHw = latestAllHw.find(h => h.id === hw.id) || hw;
      const latestSubs = Array.isArray(latestHw.submissions) ? latestHw.submissions : [];
      latestSubs.forEach(s => expandedStudentIds.add(s.studentId));
      renderSubmissionsList();
    });

    modalEl.querySelector('#btn-collapse-all')?.addEventListener('click', () => {
      expandedStudentIds.clear();
      renderSubmissionsList();
    });

    // Save All Grades Action
    const saveGradesAction = async () => {
      const latestAllHw = firebaseService.getCollection('homework');
      const latestHw = latestAllHw.find(h => h.id === hw.id) || hw;
      const currentSubs = Array.isArray(latestHw.submissions) ? [...latestHw.submissions] : [];

      modalEl.querySelectorAll('.sub-score-input').forEach(input => {
        const stdId = input.dataset.studentId;
        const subObj = currentSubs.find(s => s.studentId === stdId);
        if (subObj) {
          const val = input.value.trim();
          subObj.score = val !== '' ? parseInt(val, 10) : null;
          subObj.status = val !== '' ? 'Graded' : 'Pending';
        }
      });

      modalEl.querySelectorAll('.sub-feedback-input').forEach(input => {
        const stdId = input.dataset.studentId;
        const subObj = currentSubs.find(s => s.studentId === stdId);
        if (subObj) {
          subObj.feedback = input.value.trim();
        }
      });

      await firebaseService.updateItem('homework', hw.id, { submissions: currentSubs });
      await showAlertModal({
        title: '💾 บันทึกการตรวจงานสำเร็จ',
        message: `บันทึกการตรวจงานของนักเรียนทั้งหมด ${currentSubs.length} คน เรียบร้อยแล้ว`,
        type: 'success'
      });
      modalEl.remove();
      refreshCb();
    };

    modalEl.querySelector('#close-grade-btn')?.addEventListener('click', saveGradesAction);

    modalEl.querySelectorAll('#close-grade-modal-x, #close-grade-cancel-btn').forEach(b => b.addEventListener('click', () => {
      modalEl.remove();
      refreshCb();
    }));
  }
}
