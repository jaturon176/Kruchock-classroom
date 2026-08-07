/**
 * Clubs & Activities Module (โมดูลกิจกรรมชุมนุม / ชมรม)
 * Handles:
 * - Club Creation & Management (ชื่อชมรม, ครูประจำชมรม, เวลา/สถานที่นัดหมาย, จำนวนที่รับ)
 * - Dynamic Student Enrollment & Roster Management (เพิ่มนักเรียนจากระบบ)
 * - Club Attendance Register (เช็กชื่อเข้าเรียนกิจกรรม 4 สถานะ: มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴)
 * - Assignments & Pass/Fail Evaluation (มอบหมายงาน และประเมิน ผ่าน / ไม่ผ่าน)
 * - Student Portal (นักเรียนดูสถิติเข้าเรียน ส่งงานชมรม และดูผลการประเมิน)
 * - Official Thai Activity Evaluation Summary Report (รายงานสรุป ผ. / มผ.)
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal, showConfirmModal, showImagePreviewModal } from '../services/dialogService.js';
import { uploadImageToCloudinary } from '../services/cloudinaryService.js';
import { formatDateThai } from './attendance.js';

export class ClubsModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedClubId = null; // null = Club Directory, string = Active Club Workspace
    this.activeClubTab = 'info'; // 'info' | 'attendance' | 'tasks' | 'report'
  }

  render(containerEl) {
    const clubs = firebaseService.getCollection('clubs') || [];
    const users = firebaseService.getCollection('users') || [];
    const currentUser = this.rbac.getCurrentUser();
    const isTeacherOrAdmin = currentUser.role === 'Teacher' || currentUser.role === 'Admin';

    // If currently viewing a specific club
    if (this.selectedClubId) {
      const activeClub = clubs.find(c => c.id === this.selectedClubId);
      if (activeClub) {
        this.renderClubWorkspace(containerEl, activeClub, clubs, users, currentUser);
        return;
      }
      this.selectedClubId = null;
    }

    // Otherwise render Club Directory View
    this.renderClubDirectory(containerEl, clubs, users, currentUser);
  }

  // 1. Club Directory List View
  renderClubDirectory(containerEl, clubs, users, currentUser) {
    const isTeacherOrAdmin = currentUser.role === 'Teacher' || currentUser.role === 'Admin';
    const studentUsers = users.filter(u => u.role === 'Student');

    // Find student's enrolled club
    const myEnrolledClub = currentUser.role === 'Student' 
      ? clubs.find(c => Array.isArray(c.members) && c.members.includes(currentUser.studentId))
      : null;

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in font-sarabun">
        <!-- Header -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 font-sarabun">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-sarabun flex items-center gap-3">
              <span class="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 text-xl">🏆</span>
              กิจกรรมพัฒนาผู้เรียน: ชุมนุม & ชมรม (Club Activities Directory)
            </h2>
            <p class="text-slate-500 text-xs mt-1 leading-relaxed font-sarabun">
              ระบบจัดการกิจกรรมชุมนุมนักเรียน เช็กชื่อเข้าเรียน มอบหมายงาน ประเมินผล ผ่าน/ไม่ผ่าน (ผ./มผ.) ตามมาตรฐานกระทรวงศึกษาธิการ
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            ${isTeacherOrAdmin ? `
              <button id="btn-create-club" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-sarabun font-bold shadow-md shadow-indigo-500/20 flex items-center gap-1.5">
                <span>➕</span> สร้างชุมนุม/ชมรมใหม่
              </button>
            ` : myEnrolledClub ? `
              <div class="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold font-sarabun flex items-center gap-2">
                <span>✅</span> สังกัดชุมนุม: <strong>${decodeMojibakeThai(myEnrolledClub.name)}</strong>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Clubs List Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 font-sarabun">
          ${clubs.length === 0 ? `
            <div class="col-span-full text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-xs p-8 font-sarabun">
              <div class="text-4xl mb-3">🏕️</div>
              <div class="text-base font-bold text-slate-800">ยังไม่มีการเปิดชุมนุม/ชมรมในระบบ</div>
              <p class="text-xs text-slate-500 mt-1">คุณครูสามารถกดปุ่ม "สร้างชุมนุม/ชมรมใหม่" เพื่อเริ่มสร้างกิจกรรมชุมนุมได้ทันที</p>
            </div>
          ` : clubs.map(club => {
            const members = Array.isArray(club.members) ? club.members : [];
            const isMember = currentUser.role === 'Student' && members.includes(currentUser.studentId);
            const isFull = members.length >= (club.maxCapacity || 40);

            return `
              <div class="glass-card p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 font-sarabun relative group">
                <div>
                  <div class="flex justify-between items-start gap-2 mb-3">
                    <span class="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[11px] font-bold">
                      🏆 ชุมนุม
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isFull ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }">
                      👥 ${members.length} / ${club.maxCapacity || 40} คน
                    </span>
                  </div>

                  <h3 class="text-lg font-bold text-slate-900 font-heading leading-tight group-hover:text-indigo-600 transition-colors">
                    ${decodeMojibakeThai(club.name)}
                  </h3>

                  <p class="text-xs text-slate-600 font-sarabun mt-2 line-clamp-2 leading-relaxed">
                    ${decodeMojibakeThai(club.description || 'ไม่มีคำอธิบาย')}
                  </p>

                  <div class="space-y-1.5 pt-3 mt-3 border-t border-slate-100 text-xs text-slate-600 font-sarabun">
                    <div class="flex items-center gap-1.5">
                      <span>👨‍🏫</span> <strong>ครูประจำชุมนุม:</strong> ${decodeMojibakeThai(club.teacherName || 'ไม่ระบุ')}
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span>⏰</span> <strong>เวลานัดหมาย:</strong> ${decodeMojibakeThai(club.meetingTime || 'ตามนัดหมาย')}
                    </div>
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 font-sarabun">
                  <button type="button" data-enter-club="${club.id}" class="btn-primary text-xs px-4 py-2 rounded-xl font-bold font-sarabun flex items-center gap-1">
                    <span>🚀</span> เข้าสู่ห้องชุมนุม
                  </button>

                  ${isTeacherOrAdmin ? `
                    <div class="flex items-center gap-1">
                      <button type="button" data-edit-club="${club.id}" class="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="แก้ไขข้อมูลชุมนุม">✏️</button>
                      <button type="button" data-del-club="${club.id}" class="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="ลบชุมนุม">🗑️</button>
                    </div>
                  ` : currentUser.role === 'Student' && !myEnrolledClub && !isFull ? `
                    <button type="button" data-enroll-club="${club.id}" class="btn-secondary text-xs px-3 py-2 rounded-xl font-bold font-sarabun bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100">
                      ✍️ สมัครเข้าชุมนุม
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind Create Club Action
    containerEl.querySelector('#btn-create-club')?.addEventListener('click', () => {
      this.showClubFormModal(null, users, containerEl);
    });

    // Bind Enter Club Action
    containerEl.querySelectorAll('[data-enter-club]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedClubId = e.currentTarget.dataset.enterClub;
        this.render(containerEl);
      });
    });

    // Bind Edit Club Action
    containerEl.querySelectorAll('[data-edit-club]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const clubId = e.currentTarget.dataset.editClub;
        const targetClub = clubs.find(c => c.id === clubId);
        if (targetClub) this.showClubFormModal(targetClub, users, containerEl);
      });
    });

    // Bind Delete Club Action
    containerEl.querySelectorAll('[data-del-club]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const clubId = e.currentTarget.dataset.delClub;
        const targetClub = clubs.find(c => c.id === clubId);
        if (!targetClub) return;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบกิจกรรมชุมนุม',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบชุมนุม "${decodeMojibakeThai(targetClub.name)}"? ข้อมูลสมาชิก ประวัติการเช็กชื่อ และงานทั้งหมดจะถูกลบออกจากระบบ`,
          confirmText: 'ลบชุมนุม',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('clubs', clubId);
          await showAlertModal({ title: '🗑️ ลบข้อมูลสำเร็จ', message: 'ลบชุมนุมเรียบร้อยแล้ว', type: 'success' });
          this.render(containerEl);
        }
      });
    });

    // Bind Student Enroll Action
    containerEl.querySelectorAll('[data-enroll-club]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const clubId = e.currentTarget.dataset.enrollClub;
        const targetClub = clubs.find(c => c.id === clubId);
        if (!targetClub) return;

        const members = Array.isArray(targetClub.members) ? [...targetClub.members] : [];
        if (!members.includes(currentUser.studentId)) {
          members.push(currentUser.studentId);
          firebaseService.updateItem('clubs', clubId, { members });
          await showAlertModal({
            title: '🎉 ลงทะเบียนสำเร็จ',
            message: `เข้าเป็นสมาชิกชุมนุม "${decodeMojibakeThai(targetClub.name)}" เรียบร้อยแล้ว!`,
            type: 'success'
          });
          this.render(containerEl);
        }
      });
    });
  }

  // 2. Club Workspace View (Inside Selected Club)
  renderClubWorkspace(containerEl, club, clubs, users, currentUser) {
    const isTeacherOrAdmin = currentUser.role === 'Teacher' || currentUser.role === 'Admin';
    const studentUsers = users.filter(u => u.role === 'Student');
    const memberIds = Array.isArray(club.members) ? club.members : [];
    const members = studentUsers.filter(s => memberIds.includes(s.studentId));

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in font-sarabun">
        <!-- Top Workspace Bar -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 font-sarabun flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div class="space-y-1">
            <button id="btn-back-to-clubs" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-2 font-sarabun">
              <span>←</span> กลับสู่หน้ารายการชุมนุมทั้งหมด
            </button>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-3">
              <span class="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 text-xl">🏕️</span>
              ${decodeMojibakeThai(club.name)}
            </h2>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-sarabun pt-1">
              <span>👨‍🏫 <strong>ครูประจำชุมนุม:</strong> ${decodeMojibakeThai(club.teacherName || 'ไม่ระบุ')}</span>
              <span>⏰ <strong>เวลา/สถานที่:</strong> ${decodeMojibakeThai(club.meetingTime || 'ตามนัดหมาย')}</span>
              <span>👥 <strong>สมาชิก:</strong> ${members.length} / ${club.maxCapacity || 40} คน</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 font-sarabun">
            ${isTeacherOrAdmin ? `
              <button id="btn-add-club-member" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-500/20">
                ➕ เพิ่มนักเรียนเข้าชุมนุม
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Navigation Tabs inside Club Workspace -->
        <div class="flex flex-wrap items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xs font-sarabun">
          <button id="club-tab-info" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            this.activeClubTab === 'info' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }">
            📌 ข้อมูล & รายชื่อสมาชิก (${members.length})
          </button>
          <button id="club-tab-att" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            this.activeClubTab === 'attendance' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }">
            ⏱️ เช็กชื่อเข้าเรียนชมรม
          </button>
          <button id="club-tab-tasks" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            this.activeClubTab === 'tasks' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }">
            📋 งานที่มอบหมาย & การประเมิน
          </button>
          <button id="club-tab-report" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            this.activeClubTab === 'report' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }">
            📊 สรุปผลการประเมิน (ผ. / มผ.)
          </button>
        </div>

        <!-- Workspace Tab Content -->
        <div id="club-tab-content" class="font-sarabun">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;

    const tabContentEl = containerEl.querySelector('#club-tab-content');

    // Render active tab content
    if (this.activeClubTab === 'info') {
      this.renderClubInfoTab(tabContentEl, club, members, isTeacherOrAdmin, containerEl);
    } else if (this.activeClubTab === 'attendance') {
      this.renderClubAttendanceTab(tabContentEl, club, members, isTeacherOrAdmin, currentUser, containerEl);
    } else if (this.activeClubTab === 'tasks') {
      this.renderClubTasksTab(tabContentEl, club, members, isTeacherOrAdmin, currentUser, containerEl);
    } else if (this.activeClubTab === 'report') {
      this.renderClubReportTab(tabContentEl, club, members, isTeacherOrAdmin, containerEl);
    }

    // Event Handlers
    containerEl.querySelector('#btn-back-to-clubs')?.addEventListener('click', () => {
      this.selectedClubId = null;
      this.render(containerEl);
    });

    containerEl.querySelector('#btn-add-club-member')?.addEventListener('click', () => {
      this.showAddMemberModal(club, studentUsers, containerEl);
    });

    containerEl.querySelector('#club-tab-info')?.addEventListener('click', () => {
      this.activeClubTab = 'info';
      this.render(containerEl);
    });

    containerEl.querySelector('#club-tab-att')?.addEventListener('click', () => {
      this.activeClubTab = 'attendance';
      this.render(containerEl);
    });

    containerEl.querySelector('#club-tab-tasks')?.addEventListener('click', () => {
      this.activeClubTab = 'tasks';
      this.render(containerEl);
    });

    containerEl.querySelector('#club-tab-report')?.addEventListener('click', () => {
      this.activeClubTab = 'report';
      this.render(containerEl);
    });
  }

  // 2.1 Tab Info & Roster List
  renderClubInfoTab(containerEl, club, members, isTeacherOrAdmin, mainContainerEl) {
    containerEl.innerHTML = `
      <div class="glass-card rounded-3xl p-6 bg-white border border-slate-200 shadow-sm font-sarabun space-y-6">
        <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <h4 class="text-sm font-bold text-slate-800">📌 รายละเอียดและคำอธิบายกิจกรรมชุมนุม</h4>
          <p class="text-xs text-slate-600 leading-relaxed">${decodeMojibakeThai(club.description || 'ไม่มีรายละเอียดเพิ่มเติม')}</p>
        </div>

        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <h4 class="text-base font-bold text-slate-900 font-heading">👥 รายชื่อสมาชิกนักเรียนในชุมนุม (${members.length} คน)</h4>
          </div>

          <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table class="w-full text-left border-collapse text-xs font-sarabun">
              <thead>
                <tr class="bg-slate-100 text-slate-800 font-bold uppercase border-b border-slate-200">
                  <th class="p-3.5 text-center">ลำดับ</th>
                  <th class="p-3.5">รหัสนักเรียน</th>
                  <th class="p-3.5">ชื่อ-นามสกุล</th>
                  <th class="p-3.5 text-center">ระดับชั้น/ห้อง</th>
                  ${isTeacherOrAdmin ? `<th class="p-3.5 text-center">การจัดการ</th>` : ''}
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-sarabun">
                ${members.length === 0 ? `
                  <tr><td colspan="5" class="text-center py-10 text-slate-400">ยังไม่มีสมาชิกนักเรียนในชุมนุมนี้ คุณครูสามารถกดเพิ่มนักเรียนเข้าร่วมได้</td></tr>
                ` : members.map((s, idx) => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3.5 text-center font-bold text-slate-800">${idx + 1}</td>
                    <td class="p-3.5 font-mono font-bold text-indigo-600">${s.studentId}</td>
                    <td class="p-3.5 font-semibold text-slate-900">${decodeMojibakeThai(s.name)}</td>
                    <td class="p-3.5 text-center font-bold text-slate-700">${s.grade} / ห้อง ${s.room}</td>
                    ${isTeacherOrAdmin ? `
                      <td class="p-3.5 text-center">
                        <button type="button" data-remove-member="${s.studentId}" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 text-xs transition-all">
                          🗑️ นำออกจากชุมนุม
                        </button>
                      </td>
                    ` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Remove Member Action
    containerEl.querySelectorAll('[data-remove-member]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const stdId = e.currentTarget.dataset.removeMember;
        const targetStudent = members.find(s => s.studentId === stdId);
        if (!targetStudent) return;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการนำนักเรียนออก',
          message: `คุณแน่ใจหรือไม่ว่าต้องการนำ "${decodeMojibakeThai(targetStudent.name)}" ออกจากกิจกรรมชุมนุมนี้?`,
          confirmText: 'นำออก',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          let updatedMembers = Array.isArray(club.members) ? [...club.members] : [];
          updatedMembers = updatedMembers.filter(id => id !== stdId);
          firebaseService.updateItem('clubs', club.id, { members: updatedMembers });
          this.render(mainContainerEl);
        }
      });
    });
  }

  // 2.2 Tab Attendance Register
  renderClubAttendanceTab(containerEl, club, members, isTeacherOrAdmin, currentUser, mainContainerEl) {
    const attendanceLogs = Array.isArray(club.attendanceLogs) ? club.attendanceLogs : [];
    let selectedDate = new Date().toISOString().substring(0, 10);
    let sessionTopic = '';

    const recordsState = {};
    members.forEach(s => { recordsState[s.studentId] = 'Present'; });

    containerEl.innerHTML = `
      <div class="glass-card rounded-3xl p-6 bg-white border border-slate-200 shadow-sm font-sarabun space-y-6">
        ${isTeacherOrAdmin ? `
          <div class="p-5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-4 font-sarabun">
            <h4 class="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <span>⏱️</span> บันทึกการเข้าเรียนกิจกรรมชุมนุมประจำวัน
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-indigo-900 mb-1">📅 วันที่จัดกิจกรรม:</label>
                <input type="date" id="club-att-date" value="${selectedDate}" class="input-field py-1.5 text-xs bg-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-indigo-900 mb-1">📝 หัวข้อ/กิจกรรมที่ทำ:</label>
                <input type="text" id="club-att-topic" placeholder="เช่น การปฐมนิเทศและเลือกประธานชุมนุม" class="input-field py-1.5 text-xs bg-white">
              </div>
            </div>

            <!-- Student List for Attendance -->
            <div class="rounded-xl border border-indigo-200 overflow-hidden bg-white shadow-2xs">
              <table class="w-full text-left border-collapse text-xs font-sarabun">
                <thead>
                  <tr class="bg-indigo-100/60 text-indigo-900 font-bold border-b border-indigo-200">
                    <th class="p-3 text-center">ลำดับ</th>
                    <th class="p-3">รหัสนักเรียน</th>
                    <th class="p-3">ชื่อ-นามสกุล</th>
                    <th class="p-3 text-center">สถานะการเข้าเรียน</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${members.length === 0 ? `
                    <tr><td colspan="4" class="text-center py-6 text-slate-400">ไม่มีสมาชิกนักเรียนในชุมนุม</td></tr>
                  ` : members.map((s, idx) => `
                    <tr class="hover:bg-slate-50">
                      <td class="p-3 text-center font-bold">${idx + 1}</td>
                      <td class="p-3 font-mono font-bold text-indigo-600">${s.studentId}</td>
                      <td class="p-3 font-semibold">${decodeMojibakeThai(s.name)}</td>
                      <td class="p-3 text-center">
                        <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1" data-club-std-status="${s.studentId}">
                          <button type="button" data-status="Present" class="att-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white">🟢 มา</button>
                          <button type="button" data-status="Late" class="att-btn px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600">🟡 สาย</button>
                          <button type="button" data-status="Leave" class="att-btn px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600">🔵 ลา</button>
                          <button type="button" data-status="Absent" class="att-btn px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600">🔴 ขาด</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button id="btn-save-club-att" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-500/20">
                💾 บันทึกการเช็กชื่อชมรม
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Attendance History Logs -->
        <div class="space-y-3">
          <h4 class="text-base font-bold text-slate-900 font-heading">📜 ประวัติการเข้าเรียนชุมนุมย้อนหลัง (${attendanceLogs.length} ครั้ง)</h4>

          <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table class="w-full text-left border-collapse text-xs font-sarabun">
              <thead>
                <tr class="bg-slate-100 text-slate-800 font-bold uppercase border-b border-slate-200">
                  <th class="p-3.5">วันที่จัดกิจกรรม</th>
                  <th class="p-3.5">หัวข้อ/กิจกรรม</th>
                  <th class="p-3.5 text-center">มาเรียน</th>
                  <th class="p-3.5 text-center">สาย</th>
                  <th class="p-3.5 text-center">ลา</th>
                  <th class="p-3.5 text-center">ขาด</th>
                  ${isTeacherOrAdmin ? `<th class="p-3.5 text-center">การจัดการ</th>` : `<th class="p-3.5 text-center">สถานะของคุณ</th>`}
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-sarabun">
                ${attendanceLogs.length === 0 ? `
                  <tr><td colspan="7" class="text-center py-10 text-slate-400">ยังไม่มีการบันทึกประวัติการเข้าเรียนกิจกรรมชุมนุม</td></tr>
                ` : attendanceLogs.map(log => {
                  const recs = log.records || {};
                  let present = 0, late = 0, leave = 0, absent = 0;
                  Object.values(recs).forEach(st => {
                    if (st === 'Present') present++;
                    else if (st === 'Late') late++;
                    else if (st === 'Leave') leave++;
                    else if (st === 'Absent') absent++;
                  });

                  const myStatus = currentUser.role === 'Student' ? recs[currentUser.studentId] : null;

                  return `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="p-3.5 font-mono font-bold text-slate-800">${formatDateThai(log.date)}</td>
                      <td class="p-3.5 font-semibold text-indigo-900">${decodeMojibakeThai(log.topic || 'กิจกรรมชุมนุม')}</td>
                      <td class="p-3.5 text-center font-bold text-emerald-700 bg-emerald-50/40">${present} คน</td>
                      <td class="p-3.5 text-center font-bold text-amber-700 bg-amber-50/40">${late} คน</td>
                      <td class="p-3.5 text-center font-bold text-sky-700 bg-sky-50/40">${leave} คน</td>
                      <td class="p-3.5 text-center font-bold text-rose-700 bg-rose-50/40">${absent} คน</td>
                      ${isTeacherOrAdmin ? `
                        <td class="p-3.5 text-center">
                          <button type="button" data-del-club-att="${log.id}" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 text-xs">
                            🗑️ ลบ
                          </button>
                        </td>
                      ` : `
                        <td class="p-3.5 text-center font-bold">
                          <span class="px-2.5 py-1 rounded-full text-[11px] ${
                            myStatus === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                            myStatus === 'Late' ? 'bg-amber-100 text-amber-800' :
                            myStatus === 'Leave' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                          }">
                            ${myStatus === 'Present' ? '🟢 มา' : myStatus === 'Late' ? '🟡 สาย' : myStatus === 'Leave' ? '🔵 ลา' : '🔴 ขาด'}
                          </span>
                        </td>
                      `}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Status Toggle Buttons inside attendance form
    containerEl.querySelectorAll('[data-club-std-status]').forEach(group => {
      const stdId = group.dataset.clubStdStatus;
      group.querySelectorAll('.att-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const status = e.currentTarget.dataset.status;
          recordsState[stdId] = status;
          group.querySelectorAll('.att-btn').forEach(b => b.className = 'att-btn px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600');
          if (status === 'Present') e.currentTarget.className = 'att-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white';
          else if (status === 'Late') e.currentTarget.className = 'att-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white';
          else if (status === 'Leave') e.currentTarget.className = 'att-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500 text-white';
          else if (status === 'Absent') e.currentTarget.className = 'att-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white';
        });
      });
    });

    // Save Attendance Action
    containerEl.querySelector('#btn-save-club-att')?.addEventListener('click', async () => {
      const dateVal = containerEl.querySelector('#club-att-date').value;
      const topicVal = containerEl.querySelector('#club-att-topic').value.trim();

      const newLog = {
        id: 'att_' + Date.now(),
        date: dateVal,
        topic: topicVal || 'กิจกรรมชุมนุมประจำสัปดาห์',
        records: recordsState
      };

      const updatedLogs = [...attendanceLogs, newLog];
      firebaseService.updateItem('clubs', club.id, { attendanceLogs: updatedLogs });

      await showAlertModal({
        title: '💾 บันทึกการเช็กชื่อสำเร็จ',
        message: `บันทึกเวลาเรียนกิจกรรมชุมนุมเรียบร้อยแล้ว`,
        type: 'success'
      });
      this.render(mainContainerEl);
    });

    // Delete Attendance Log
    containerEl.querySelectorAll('[data-del-club-att]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const logId = e.currentTarget.dataset.delClubAtt;
        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบประวัติเช็กชื่อ',
          message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการเช็กชื่อนี้?',
          confirmText: 'ลบรายการ',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          const updatedLogs = attendanceLogs.filter(l => l.id !== logId);
          firebaseService.updateItem('clubs', club.id, { attendanceLogs: updatedLogs });
          this.render(mainContainerEl);
        }
      });
    });
  }

  // 2.3 Tab Assignments & Pass/Fail Evaluation
  renderClubTasksTab(containerEl, club, members, isTeacherOrAdmin, currentUser, mainContainerEl) {
    const assignments = Array.isArray(club.assignments) ? club.assignments : [];

    containerEl.innerHTML = `
      <div class="glass-card rounded-3xl p-6 bg-white border border-slate-200 shadow-sm font-sarabun space-y-6">
        <div class="flex justify-between items-center flex-wrap gap-3">
          <h4 class="text-base font-bold text-slate-900 font-heading">📋 ชิ้นงานและภาระงานชมรม (${assignments.length} งาน)</h4>
          ${isTeacherOrAdmin ? `
            <button id="btn-create-club-task" class="btn-primary text-xs px-4 py-2 rounded-xl font-bold shadow-md shadow-indigo-500/20">
              ➕ มอบหมายงานใหม่
            </button>
          ` : ''}
        </div>

        <div class="space-y-4 font-sarabun">
          ${assignments.length === 0 ? `
            <div class="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              ยังไม่มีการมอบหมายงานในชุมนุมนี้
            </div>
          ` : assignments.map(task => {
            const subs = task.submissions || {};
            const subCount = Object.keys(subs).length;
            const mySub = currentUser.role === 'Student' ? subs[currentUser.studentId] : null;

            return `
              <div class="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 hover:border-slate-300 transition-all font-sarabun">
                <div class="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h5 class="text-base font-bold text-slate-900 font-heading">${decodeMojibakeThai(task.title)}</h5>
                    <div class="text-xs text-slate-500 font-sarabun mt-0.5">
                      📅 กำหนดส่ง: <strong>${formatDateThai(task.dueDate)}</strong> | มอบหมายเมื่อ: ${task.createdAt || '-'}
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    ${isTeacherOrAdmin ? `
                      <button type="button" data-grade-club-task="${task.id}" class="btn-secondary text-xs px-3.5 py-1.5 rounded-xl font-bold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100">
                        🔍 ตรวจงานนักเรียน (${subCount}/${members.length} คน)
                      </button>
                      <button type="button" data-del-club-task="${task.id}" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="ลบภาระงาน">🗑️</button>
                    ` : `
                      <span class="px-3 py-1 rounded-full text-xs font-bold ${
                        mySub && mySub.evalStatus === 'Pass' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        mySub && mySub.evalStatus === 'Fail' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        mySub ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }">
                        ${
                          mySub && mySub.evalStatus === 'Pass' ? '🟢 ผ่าน (Pass)' :
                          mySub && mySub.evalStatus === 'Fail' ? '🔴 ไม่ผ่าน (Fail)' :
                          mySub ? '⏳ รอผลการประเมิน' : '⚪ ยังไม่ส่งงาน'
                        }
                      </span>
                    `}
                  </div>
                </div>

                <p class="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                  ${decodeMojibakeThai(task.description || 'ไม่มีคำอธิบาย')}
                </p>

                ${task.imageFile ? `
                  <div class="pt-1">
                    <img src="${task.imageFile}" class="max-h-48 rounded-xl border border-slate-200 object-contain cursor-pointer" data-preview-img="${task.imageFile}" data-student-name="รูปภาพประกอบภาระงาน">
                  </div>
                ` : ''}

                ${currentUser.role === 'Student' ? `
                  <div class="pt-3 border-t border-slate-100 flex justify-end">
                    <button type="button" data-submit-club-task="${task.id}" class="btn-primary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5">
                      <span>📤</span> ${mySub ? 'แก้ไขงานที่ส่ง' : 'ส่งงานชิ้นนี้'}
                    </button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Create Task Handler
    containerEl.querySelector('#btn-create-club-task')?.addEventListener('click', () => {
      this.showTaskFormModal(club, mainContainerEl);
    });

    // Student Submit Task Handler
    containerEl.querySelectorAll('[data-submit-club-task]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.currentTarget.dataset.submitClubTask;
        const task = assignments.find(t => t.id === taskId);
        if (task) this.showStudentSubmissionModal(club, task, currentUser, mainContainerEl);
      });
    });

    // Teacher Grade Task Handler (Pass/Fail Evaluation)
    containerEl.querySelectorAll('[data-grade-club-task]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.currentTarget.dataset.gradeClubTask;
        const task = assignments.find(t => t.id === taskId);
        if (task) this.showPassFailGradingModal(club, task, members, mainContainerEl);
      });
    });

    // Delete Task Handler
    containerEl.querySelectorAll('[data-del-club-task]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const taskId = e.currentTarget.dataset.delClubTask;
        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบภาระงาน',
          message: 'คุณแน่ใจหรือไม่ว่าต้องการลบภาระงานนี้?',
          confirmText: 'ลบภาระงาน',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          const updatedTasks = assignments.filter(t => t.id !== taskId);
          firebaseService.updateItem('clubs', club.id, { assignments: updatedTasks });
          this.render(mainContainerEl);
        }
      });
    });

    // Image Preview Lightbox
    containerEl.querySelectorAll('[data-preview-img]').forEach(img => {
      img.addEventListener('click', (e) => {
        showImagePreviewModal({ imageUrl: e.currentTarget.dataset.previewImg, title: '🖼️ รูปภาพประกอบภาระงาน' });
      });
    });
  }

  // 2.4 Tab Pass/Fail Evaluation Summary Official Report
  renderClubReportTab(containerEl, club, members, isTeacherOrAdmin, mainContainerEl) {
    const attendanceLogs = Array.isArray(club.attendanceLogs) ? club.attendanceLogs : [];
    const assignments = Array.isArray(club.assignments) ? club.assignments : [];
    const totalSessions = attendanceLogs.length;

    const reportData = members.map((s, idx) => {
      // Calculate attendance count
      let attendedCount = 0;
      attendanceLogs.forEach(log => {
        const status = log.records ? log.records[s.studentId] : null;
        if (status === 'Present' || status === 'Late') attendedCount++;
      });

      const attPercentage = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;

      // Calculate tasks passed count
      let passedTasks = 0;
      assignments.forEach(t => {
        const sub = t.submissions ? t.submissions[s.studentId] : null;
        if (sub && sub.evalStatus === 'Pass') passedTasks++;
      });

      // Overall Ministry Result: Attendance >= 80% and Tasks Passed >= 50%
      const isOverallPass = attPercentage >= 80 && (assignments.length === 0 || passedTasks >= Math.ceil(assignments.length / 2));

      return {
        ...s,
        no: idx + 1,
        attendedCount,
        attPercentage,
        passedTasks,
        isOverallPass
      };
    });

    containerEl.innerHTML = `
      <div class="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm font-sarabun space-y-5">
        <!-- Official Government Report Header -->
        <div class="text-center border-b border-slate-200 pb-4 space-y-1">
          <div class="flex items-center justify-center gap-3 mb-1">
            <img src="./logo.jpg" class="w-14 h-14 object-contain rounded-xl border border-slate-200 p-0.5 shadow-xs">
            <div class="text-left">
              <h3 class="text-xl font-bold text-slate-900 font-sarabun">โรงเรียนพรมเทพพิทยาคม</h3>
              <p class="text-xs font-semibold text-slate-600 font-sarabun">แบบรายงานสรุปผลการประเมินกิจกรรมพัฒนาผู้เรียน (กิจกรรมชุมนุม/ชมรม)</p>
            </div>
          </div>
          
          <div class="flex flex-wrap justify-center items-center gap-x-6 gap-y-1 text-xs font-medium text-slate-700 pt-2 border-t border-dashed border-slate-200">
            <span><strong>🏆 กิจกรรมชุมนุม:</strong> ${decodeMojibakeThai(club.name)}</span>
            <span><strong>👨‍🏫 ครูประจำชุมนุม:</strong> ${decodeMojibakeThai(club.teacherName || 'ไม่ระบุ')}</span>
            <span><strong>👥 จำนวนสมาชิก:</strong> ${members.length} คน</span>
          </div>
        </div>

        <!-- Summary Stats Pills -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3 bg-slate-100 rounded-2xl text-center border border-slate-200">
            <div class="text-[11px] font-bold text-slate-600">👥 นักเรียนทั้งหมด</div>
            <div class="text-xl font-extrabold text-slate-900 mt-0.5 font-sarabun">${members.length} <span class="text-xs font-normal">คน</span></div>
          </div>
          <div class="p-3 bg-emerald-50 rounded-2xl text-center border border-emerald-100">
            <div class="text-[11px] font-bold text-emerald-800">🟢 ผ่านเกณฑ์ (ผ.)</div>
            <div class="text-xl font-extrabold text-emerald-700 mt-0.5 font-sarabun">${reportData.filter(r => r.isOverallPass).length} <span class="text-xs font-normal">คน</span></div>
          </div>
          <div class="p-3 bg-rose-50 rounded-2xl text-center border border-rose-100">
            <div class="text-[11px] font-bold text-rose-800">🔴 ไม่ผ่านเกณฑ์ (มผ.)</div>
            <div class="text-xl font-extrabold text-rose-700 mt-0.5 font-sarabun">${reportData.filter(r => !r.isOverallPass).length} <span class="text-xs font-normal">คน</span></div>
          </div>
          <div class="p-3 bg-indigo-50 rounded-2xl text-center border border-indigo-100">
            <div class="text-[11px] font-bold text-indigo-800">📋 กิจกรรม/ภาระงาน</div>
            <div class="text-xl font-extrabold text-indigo-700 mt-0.5 font-sarabun">${assignments.length} <span class="text-xs font-normal">งาน</span></div>
          </div>
        </div>

        <!-- Official Report Table -->
        <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table class="w-full text-left border-collapse text-xs font-sarabun">
            <thead>
              <tr class="bg-slate-100 text-slate-800 font-bold uppercase border-b border-slate-200">
                <th class="p-3 text-center border-r border-slate-200 w-12">ลำดับ</th>
                <th class="p-3 border-r border-slate-200 w-28">รหัสนักเรียน</th>
                <th class="p-3 border-r border-slate-200">ชื่อ - นามสกุล</th>
                <th class="p-3 text-center border-r border-slate-200">ชั้น/ห้อง</th>
                <th class="p-3 text-center border-r border-slate-200">สถิติเข้าเรียน</th>
                <th class="p-3 text-center border-r border-slate-200">ภาระงานที่ผ่าน</th>
                <th class="p-3 text-center w-28">ผลการประเมิน</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-sarabun">
              ${reportData.length === 0 ? `
                <tr><td colspan="7" class="text-center py-10 text-slate-400">ยังไม่มีรายชื่อสมาชิกในชุมนุมนี้</td></tr>
              ` : reportData.map(st => `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-3 text-center font-bold text-slate-800 border-r border-slate-100">${st.no}</td>
                  <td class="p-3 font-mono font-bold text-indigo-600 border-r border-slate-100">${st.studentId}</td>
                  <td class="p-3 font-semibold text-slate-900 border-r border-slate-100">${decodeMojibakeThai(st.name)}</td>
                  <td class="p-3 text-center border-r border-slate-100 font-bold text-slate-700">${st.grade}/${st.room}</td>
                  <td class="p-3 text-center border-r border-slate-100 font-bold">
                    ${st.attendedCount}/${totalSessions} ครั้ง (${st.attPercentage}%)
                  </td>
                  <td class="p-3 text-center border-r border-slate-100 font-bold">
                    ${st.passedTasks}/${assignments.length} งาน
                  </td>
                  <td class="p-3 text-center">
                    <span class="px-3 py-1 rounded-full font-extrabold text-xs ${
                      st.isOverallPass ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }">
                      ${st.isOverallPass ? 'ผ. (ผ่าน)' : 'มผ. (ไม่ผ่าน)'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex justify-end pt-2">
          <button type="button" onclick="window.print()" class="btn-secondary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5">
            <span>🖨️</span> พิมพ์รายงานสรุปผลการประเมิน (PDF)
          </button>
        </div>
      </div>
    `;
  }

  // Modal: Create / Edit Club
  showClubFormModal(club, users, mainContainerEl) {
    const isEdit = !!club;
    const teacherUsers = users.filter(u => u.role === 'Teacher' || u.role === 'Admin');

    const modalHTML = `
      <div id="club-form-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white font-sarabun space-y-4">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold font-heading text-slate-900">
              ${isEdit ? '✏️ แก้ไขข้อมูลกิจกรรมชุมนุม' : '➕ สร้างกิจกรรมชุมนุม/ชมรมใหม่'}
            </h3>
            <button id="close-club-form" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="club-form-el" class="space-y-3 font-sarabun">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อชุมนุม/ชมรม:</label>
              <input type="text" id="club-name-input" class="input-field py-1.5 text-xs" value="${club ? decodeMojibakeThai(club.name) : ''}" required placeholder="เช่น ชมรมคอมพิวเตอร์และหุ่นยนต์">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ครูประจำชุมนุม:</label>
              <input type="text" id="club-teacher-input" class="input-field py-1.5 text-xs" value="${club ? decodeMojibakeThai(club.teacherName) : ''}" required placeholder="เช่น ครูสุริยะ วงศ์มา">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">เวลานัดหมาย & สถานที่:</label>
              <input type="text" id="club-time-input" class="input-field py-1.5 text-xs" value="${club ? decodeMojibakeThai(club.meetingTime) : ''}" placeholder="เช่น ทุกวันพุธ คาบที่ 7 ณ ห้องปฏิบัติการคอมพิวเตอร์">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">จำนวนที่เปิดรับ (คน):</label>
                <input type="number" id="club-cap-input" min="5" max="100" class="input-field py-1.5 text-xs" value="${club ? club.maxCapacity || 40 : 40}">
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">รายละเอียด & วัตถุประสงค์ชมรม:</label>
              <textarea id="club-desc-input" rows="3" class="input-field py-1.5 text-xs" placeholder="สรุปเป้าหมายของชมรม...">${club ? decodeMojibakeThai(club.description) : ''}</textarea>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" id="close-club-cancel" class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">ยกเลิก</button>
              <button type="submit" class="btn-primary px-5 py-2 text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20">
                ${isEdit ? '💾 บันทึกการแก้ไข' : '➕ ยืนยันการสร้างชมรม'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('club-form-modal');

    modalEl.querySelector('#club-form-el').addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('club-name-input').value.trim(),
        teacherName: document.getElementById('club-teacher-input').value.trim(),
        meetingTime: document.getElementById('club-time-input').value.trim(),
        maxCapacity: parseInt(document.getElementById('club-cap-input').value, 10) || 40,
        description: document.getElementById('club-desc-input').value.trim(),
        members: club ? (club.members || []) : [],
        assignments: club ? (club.assignments || []) : [],
        attendanceLogs: club ? (club.attendanceLogs || []) : []
      };

      if (isEdit) {
        firebaseService.updateItem('clubs', club.id, payload);
      } else {
        firebaseService.addItem('clubs', payload);
      }

      modalEl.remove();
      this.render(mainContainerEl);
    });

    modalEl.querySelectorAll('#close-club-form, #close-club-cancel').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }

  // Modal: Add Members Picker (จากฐานข้อมูลนักเรียนในระบบ)
  showAddMemberModal(club, studentUsers, mainContainerEl) {
    const currentMemberIds = new Set(club.members || []);
    let gradeFilter = 'All';

    const modalHTML = `
      <div id="add-member-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-2xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[85vh] flex flex-col space-y-4 font-sarabun">
          
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <h3 class="text-lg font-bold font-heading text-slate-900">
              ➕ เลือกเพิ่มนักเรียนเข้ากิจกรรมชุมนุม (${decodeMojibakeThai(club.name)})
            </h3>
            <button id="close-add-member" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <input type="text" id="member-search-input" class="input-field py-1.5 text-xs" placeholder="🔍 ค้นหาชื่อนักเรียน หรือ รหัสนักเรียน...">
          </div>

          <div id="member-picker-container" class="flex-1 overflow-y-auto space-y-2 pr-1">
            <!-- Dynamically populated -->
          </div>

          <div class="pt-3 border-t border-slate-100 flex justify-between items-center shrink-0">
            <span class="text-xs text-slate-500 font-bold">สมาชิกปัจจุบัน: ${currentMemberIds.size} คน</span>
            <button id="close-add-member-done" class="btn-primary px-5 py-2 text-xs font-bold rounded-xl font-sarabun">เสร็จสิ้น</button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('add-member-modal');
    const container = modalEl.querySelector('#member-picker-container');
    const searchInput = modalEl.querySelector('#member-search-input');

    const renderPickerList = (search = '') => {
      let filtered = studentUsers;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(s => 
          decodeMojibakeThai(s.name).toLowerCase().includes(q) || 
          (s.studentId && s.studentId.toLowerCase().includes(q))
        );
      }

      container.innerHTML = filtered.map(s => {
        const isAdded = currentMemberIds.has(s.studentId);
        return `
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center font-sarabun hover:bg-slate-100/80 transition-all">
            <div>
              <div class="font-bold text-slate-900 text-xs">${decodeMojibakeThai(s.name)} (${s.studentId})</div>
              <div class="text-[11px] text-slate-500">ชั้น ${s.grade} / ห้อง ${s.room}</div>
            </div>
            <button type="button" data-toggle-std="${s.studentId}" class="px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              isAdded ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-600 text-white shadow-xs'
            }">
              ${isAdded ? '❌ นำออก' : '➕ เพิ่มเข้าชุมนุม'}
            </button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('[data-toggle-std]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const stdId = e.currentTarget.dataset.toggleStd;
          const updatedMembers = Array.isArray(club.members) ? [...club.members] : [];

          if (currentMemberIds.has(stdId)) {
            currentMemberIds.delete(stdId);
            const idx = updatedMembers.indexOf(stdId);
            if (idx >= 0) updatedMembers.splice(idx, 1);
          } else {
            currentMemberIds.add(stdId);
            updatedMembers.push(stdId);
          }

          club.members = updatedMembers;
          firebaseService.updateItem('clubs', club.id, { members: updatedMembers });
          renderPickerList(search);
        });
      });
    };

    renderPickerList();

    if (searchInput) {
      searchInput.addEventListener('input', (e) => renderPickerList(e.target.value));
    }

    modalEl.querySelectorAll('#close-add-member, #close-add-member-done').forEach(b => b.addEventListener('click', () => {
      modalEl.remove();
      this.render(mainContainerEl);
    }));
  }

  // Modal: Create Task for Club
  showTaskFormModal(club, mainContainerEl) {
    let uploadedTaskImg = '';

    const modalHTML = `
      <div id="club-task-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white font-sarabun space-y-4">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold font-heading text-slate-900">➕ มอบหมายงานชิ้นใหม่ในชุมนุม</h3>
            <button id="close-task-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="task-form-el" class="space-y-3 font-sarabun">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">หัวข้อภาระงาน:</label>
              <input type="text" id="task-title" class="input-field py-1.5 text-xs" required placeholder="เช่น ออกแบบสรุปการทำกิจกรรม">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">คำอธิบายงาน:</label>
              <textarea id="task-desc" rows="3" class="input-field py-1.5 text-xs" placeholder="รายละเอียดของงานที่มอบหมาย..."></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">กำหนดส่งงาน:</label>
              <input type="date" id="task-due" value="${new Date().toISOString().substring(0, 10)}" class="input-field py-1.5 text-xs">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">รูปภาพประกอบภาระงาน (ถ้ามี):</label>
              <input type="file" id="task-img-file" accept="image/*" class="input-field py-1 text-xs">
              <div id="task-img-status" class="text-[11px] text-slate-500 mt-1">จัดเก็บไฟล์รูปบน Cloudinary CDN ☁️</div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" id="close-task-cancel" class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">ยกเลิก</button>
              <button type="submit" class="btn-primary px-5 py-2 text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20">
                💾 บันทึกภาระงาน
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('club-task-modal');
    const fileInput = modalEl.querySelector('#task-img-file');
    const statusText = modalEl.querySelector('#task-img-status');

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        statusText.innerHTML = `⏳ กำลังอัปโหลดภาพขึ้น Cloudinary CDN...`;
        try {
          uploadedTaskImg = await uploadImageToCloudinary(e.target.files[0], 1200, 0.8);
          statusText.innerHTML = `✅ อัปโหลดรูปภาพสำเร็จ!`;
        } catch (err) {
          statusText.innerHTML = `❌ อัปโหลดรูปภาพล้มเหลว`;
        }
      }
    });

    modalEl.querySelector('#task-form-el').addEventListener('submit', (e) => {
      e.preventDefault();
      const newTask = {
        id: 'task_' + Date.now(),
        title: document.getElementById('task-title').value.trim(),
        description: document.getElementById('task-desc').value.trim(),
        dueDate: document.getElementById('task-due').value,
        imageFile: uploadedTaskImg,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        submissions: {}
      };

      const assignments = Array.isArray(club.assignments) ? [...club.assignments, newTask] : [newTask];
      firebaseService.updateItem('clubs', club.id, { assignments });

      modalEl.remove();
      this.render(mainContainerEl);
    });

    modalEl.querySelectorAll('#close-task-modal, #close-task-cancel').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }

  // Modal: Student Submit Work for Club Task
  showStudentSubmissionModal(club, task, currentUser, mainContainerEl) {
    const submissions = task.submissions || {};
    const existingSub = submissions[currentUser.studentId];
    let uploadedSubImg = existingSub ? existingSub.imageFile || '' : '';

    const modalHTML = `
      <div id="std-sub-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white font-sarabun space-y-4">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold font-heading text-slate-900">
              📤 ส่งงานกิจกรรมชมรม: ${decodeMojibakeThai(task.title)}
            </h3>
            <button id="close-std-sub" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="std-sub-form" class="space-y-3 font-sarabun">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ข้อความคำตอบ/รายงานการทำกิจกรรม:</label>
              <textarea id="sub-text" rows="4" class="input-field py-1.5 text-xs" placeholder="พิมพ์สรุปรายงานของนักเรียน...">${existingSub ? decodeMojibakeThai(existingSub.textResponse) : ''}</textarea>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">แนบรูปภาพชิ้นงาน (Cloudinary CDN):</label>
              <input type="file" id="sub-img-file" accept="image/*" class="input-field py-1 text-xs">
              <div id="sub-img-status" class="text-[11px] text-slate-500 mt-1">
                ${uploadedSubImg ? `✅ มีรูปภาพที่แนบแล้ว` : `จัดเก็บไฟล์รูปบน Cloudinary CDN ☁️`}
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" id="close-std-sub-cancel" class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">ยกเลิก</button>
              <button type="submit" class="btn-primary px-5 py-2 text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20">
                🚀 ส่งงานชมรม
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('std-sub-modal');
    const fileInput = modalEl.querySelector('#sub-img-file');
    const statusText = modalEl.querySelector('#sub-img-status');

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        statusText.innerHTML = `⏳ กำลังอัปโหลดภาพขึ้น Cloudinary CDN...`;
        try {
          uploadedSubImg = await uploadImageToCloudinary(e.target.files[0], 1200, 0.8);
          statusText.innerHTML = `✅ อัปโหลดรูปภาพสำเร็จ!`;
        } catch (err) {
          statusText.innerHTML = `❌ อัปโหลดรูปภาพล้มเหลว`;
        }
      }
    });

    modalEl.querySelector('#std-sub-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const newSub = {
        studentId: currentUser.studentId,
        studentName: currentUser.name,
        submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        textResponse: document.getElementById('sub-text').value.trim(),
        imageFile: uploadedSubImg,
        evalStatus: existingSub ? existingSub.evalStatus : 'Pending',
        feedback: existingSub ? existingSub.feedback || '' : ''
      };

      const assignments = Array.isArray(club.assignments) ? [...club.assignments] : [];
      const targetTaskIndex = assignments.findIndex(t => t.id === task.id);
      if (targetTaskIndex >= 0) {
        if (!assignments[targetTaskIndex].submissions) assignments[targetTaskIndex].submissions = {};
        assignments[targetTaskIndex].submissions[currentUser.studentId] = newSub;
        firebaseService.updateItem('clubs', club.id, { assignments });
      }

      modalEl.remove();
      this.render(mainContainerEl);
    });

    modalEl.querySelectorAll('#close-std-sub, #close-std-sub-cancel').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }

  // Modal: Teacher Pass/Fail Evaluation Grading
  showPassFailGradingModal(club, task, members, mainContainerEl) {
    const submissions = task.submissions || {};

    const modalHTML = `
      <div id="club-grade-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-4xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] flex flex-col space-y-4 font-sarabun">
          
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h3 class="text-lg font-bold font-heading text-slate-900">
                🔍 ประเมินงานชมรม (ผ่าน/ไม่ผ่าน): ${decodeMojibakeThai(task.title)}
              </h3>
              <p class="text-xs text-slate-500">ประเมินผล ผ่าน (Pass) / ไม่ผ่าน (Fail) สำหรับนักเรียนในชุมนุม</p>
            </div>
            <button id="close-club-grade" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-4 pr-1">
            ${members.length === 0 ? `
              <div class="text-center py-10 text-slate-400">ไม่มีสมาชิกในชุมนุม</div>
            ` : members.map(s => {
              const sub = submissions[s.studentId];
              return `
                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 font-sarabun" data-eval-card="${s.studentId}">
                  <div class="flex justify-between items-center flex-wrap gap-2">
                    <div class="font-bold text-slate-900 text-sm">
                      👤 ${decodeMojibakeThai(s.name)} (${s.studentId}) — ชั้น ${s.grade}/${s.room}
                    </div>
                    <div class="text-xs text-slate-500 font-mono">
                      ${sub ? `📅 ส่งเมื่อ: ${sub.submittedAt}` : `⚪ ยังไม่ส่งงาน`}
                    </div>
                  </div>

                  ${sub ? `
                    <div class="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                      <div><strong>💬 ข้อความที่ส่ง:</strong> ${decodeMojibakeThai(sub.textResponse || 'ไม่มีข้อความ')}</div>
                      ${sub.imageFile ? `
                        <div>
                          <img src="${sub.imageFile}" class="max-h-40 rounded-lg border border-slate-200 object-contain cursor-pointer" data-preview-img="${sub.imageFile}" data-student-name="${decodeMojibakeThai(s.name)}">
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}

                  <!-- Pass / Fail Evaluation Controls -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label class="block text-[11px] font-bold text-slate-700 mb-1">ผลการประเมิน:</label>
                      <select data-eval-status="${s.studentId}" class="input-field py-1 text-xs font-bold">
                        <option value="Pass" ${sub && sub.evalStatus === 'Pass' ? 'selected' : ''}>🟢 ผ่าน (Pass)</option>
                        <option value="Fail" ${sub && sub.evalStatus === 'Fail' ? 'selected' : ''}>🔴 ไม่ผ่าน (Fail)</option>
                        <option value="Pending" ${!sub || sub.evalStatus === 'Pending' ? 'selected' : ''}>⏳ รอประเมิน</option>
                      </select>
                    </div>

                    <div>
                      <label class="block text-[11px] font-bold text-slate-700 mb-1">ข้อเสนอแนะครู:</label>
                      <input type="text" data-eval-feedback="${s.studentId}" class="input-field py-1 text-xs bg-white" value="${sub ? sub.feedback || '' : ''}" placeholder="เช่น ชิ้นงานมีความสมบูรณ์">
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="pt-3 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            <button id="btn-save-club-eval" class="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold font-heading shadow-md shadow-indigo-500/20">
              💾 บันทึกการประเมินทั้งหมด
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('club-grade-modal');

    // Lightbox
    modalEl.querySelectorAll('[data-preview-img]').forEach(img => {
      img.addEventListener('click', (e) => {
        showImagePreviewModal({ imageUrl: e.currentTarget.dataset.previewImg, title: '🖼️ รูปภาพงานส่งนักเรียน' });
      });
    });

    // Save Evaluation
    modalEl.querySelector('#btn-save-club-eval')?.addEventListener('click', async () => {
      const assignments = Array.isArray(club.assignments) ? [...club.assignments] : [];
      const targetTaskIndex = assignments.findIndex(t => t.id === task.id);

      if (targetTaskIndex >= 0) {
        if (!assignments[targetTaskIndex].submissions) assignments[targetTaskIndex].submissions = {};
        const subsObj = assignments[targetTaskIndex].submissions;

        members.forEach(s => {
          const evalStatus = modalEl.querySelector(`[data-eval-status="${s.studentId}"]`)?.value || 'Pending';
          const feedback = modalEl.querySelector(`[data-eval-feedback="${s.studentId}"]`)?.value.trim() || '';

          if (!subsObj[s.studentId]) {
            subsObj[s.studentId] = {
              studentId: s.studentId,
              studentName: s.name,
              submittedAt: '-',
              textResponse: '-',
              imageFile: '',
              evalStatus,
              feedback
            };
          } else {
            subsObj[s.studentId].evalStatus = evalStatus;
            subsObj[s.studentId].feedback = feedback;
          }
        });

        firebaseService.updateItem('clubs', club.id, { assignments });
      }

      await showAlertModal({ title: '💾 บันทึกผลสำเร็จ', message: 'บันทึกผลการประเมินเรียบร้อยแล้ว', type: 'success' });
      modalEl.remove();
      this.render(mainContainerEl);
    });

    modalEl.querySelector('#close-club-grade')?.addEventListener('click', () => modalEl.remove());
  }
}
