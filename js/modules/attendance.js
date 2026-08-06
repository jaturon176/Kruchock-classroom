/**
 * Attendance Module
 * Period attendance register with 4-state status toggles (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴),
 * dynamic system grade/room loading, 7 period options (คาบที่ 1-7),
 * Multi-Period Selection support for consecutive classes (คาบติด 2-3 คาบพร้อมกัน),
 * and Official Government Daily Attendance Detailed Report with TH Sarabun typography.
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal, showConfirmModal } from '../services/dialogService.js';
import { sortGrades, sortRooms } from './students.js';

export const PERIOD_OPTIONS = [
  'คาบที่ 1 (08:40 - 09:30)',
  'คาบที่ 2 (09:30 - 10:20)',
  'คาบที่ 3 (10:20 - 11:10)',
  'คาบที่ 4 (11:10 - 12:00)',
  'คาบที่ 5 (13:00 - 13:50)',
  'คาบที่ 6 (13:50 - 14:40)',
  'คาบที่ 7 (14:40 - 15:30)',
];

export function formatDateThai(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10) + 543;
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตูลายน', 'พฤศจิกายน', 'ธันวาคม'];
  const month = months[parseInt(parts[1], 10) - 1] || parts[1];
  const day = parseInt(parts[2], 10);
  return `${day} ${month} พ.ศ. ${year}`;
}

export class AttendanceModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedCourseId = 'All';
    this.selectedGrade = 'ม.1';
    this.selectedRoom = '1';
    this.selectedPeriods = [PERIOD_OPTIONS[0]]; // Multi-period selection array!
    this.attendanceDate = new Date().toISOString().substring(0, 10);
  }

  render(containerEl) {
    const courses = firebaseService.getCollection('courses');
    const users = firebaseService.getCollection('users');
    const attendanceList = firebaseService.getCollection('attendance');
    const currentUser = this.rbac.getCurrentUser();
    const isTeacherOrAdmin = currentUser.role === 'Teacher' || currentUser.role === 'Admin';

    // Ensure selectedPeriods array is properly initialized
    if (!this.selectedPeriods || !Array.isArray(this.selectedPeriods) || this.selectedPeriods.length === 0) {
      this.selectedPeriods = [PERIOD_OPTIONS[0]];
    }

    // 1. Dynamic Grade List from System Users DB (Sorted 1-6 naturally)
    const studentUsers = users.filter(u => u.role === 'Student');
    const rawGrades = [...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))];
    const availableGrades = sortGrades(rawGrades);
    if (availableGrades.length === 0) availableGrades.push('ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6');

    if (this.selectedGrade !== 'All' && !availableGrades.includes(this.selectedGrade)) {
      this.selectedGrade = availableGrades[0] || 'ม.1';
    }

    // 2. Dynamic Room List based on Selected Grade (Sorted naturally)
    const getRoomsForGrade = (targetGrade) => {
      let filtered = studentUsers;
      if (targetGrade !== 'All') {
        filtered = studentUsers.filter(s => s.grade === targetGrade);
      }
      const rawR = [...new Set(filtered.map(s => s.room).filter(r => r && r !== '-'))];
      const rooms = sortRooms(rawR);
      if (rooms.length === 0) rooms.push('1', '2');
      return rooms;
    };

    const availableRooms = getRoomsForGrade(this.selectedGrade);
    if (this.selectedRoom !== 'All' && !availableRooms.includes(this.selectedRoom)) {
      this.selectedRoom = availableRooms[0] || '1';
    }

    // Default selected course if 'All' or empty
    if (this.selectedCourseId === 'All' && courses.length > 0) {
      this.selectedCourseId = courses[0].id;
    }

    const students = studentUsers
      .filter(u => (this.selectedGrade === 'All' || u.grade === this.selectedGrade) && (this.selectedRoom === 'All' || u.room === this.selectedRoom))
      .sort((a, b) => (parseInt(a.no, 10) || 999) - (parseInt(b.no, 10) || 999));

    // Find existing attendance records for date + course + ANY selected periods
    const existingEntries = attendanceList.filter(a => 
      a.date === this.attendanceDate && 
      a.courseId === this.selectedCourseId && 
      this.selectedPeriods.includes(a.period)
    );

    const recordsState = {};
    existingEntries.forEach(entry => {
      if (entry.records) {
        Object.assign(recordsState, entry.records);
      }
    });

    // Fill defaults (Present) for missing students
    students.forEach(s => {
      if (!recordsState[s.studentId]) {
        recordsState[s.studentId] = 'Present';
      }
    });

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in font-sarabun">
        <!-- Header -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-sarabun flex items-center gap-3">
              <span class="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-xl">⏱️</span>
              เช็กชื่อรายคาบเรียน (Period Attendance Register)
            </h2>
            <p class="text-slate-500 text-xs mt-1 leading-relaxed font-sarabun">
              บันทึกเวลาเรียน 4 สถานะ (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴) รองรับการเลือกเช็กชื่อหลายคาบติดกัน (2-3 คาบ) พร้อมระบบรายงานสรุปรายวัน
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button id="btn-view-att-report" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-sarabun font-bold flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all">
              <span>📊</span> สรุปรายงานการเข้าเรียนรายวัน & จัดการประวัติ
            </button>
            <button id="btn-bulk-present" class="btn-secondary text-xs px-3.5 py-2.5 rounded-xl font-sarabun font-semibold">
              🟢 มาเรียนทั้งหมด
            </button>
            <button id="btn-save-attendance" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-sarabun font-semibold shadow-md shadow-indigo-500/20">
              💾 ${existingEntries.length > 0 ? `บันทึกการแก้ไข (${this.selectedPeriods.length} คาบ)` : `บันทึกการเช็กชื่อ (${this.selectedPeriods.length} คาบ)`}
            </button>
          </div>
        </div>

        <!-- Existing Record Notification Banner & Delete Button -->
        ${existingEntries.length > 0 ? `
          <div class="p-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex flex-wrap justify-between items-center gap-3 shadow-xs font-sarabun">
            <div class="flex items-center gap-2 text-xs text-indigo-900 font-bold">
              <span class="text-lg">✏️</span>
              <div>
                <div>พบบันทึกการเช็กชื่อของ ${existingEntries.length} คาบที่เลือกในระบบแล้ว (วันที่ <strong>${formatDateThai(this.attendanceDate)}</strong>)</div>
                <div class="text-[11px] font-normal text-indigo-700 mt-0.5">คุณครูสามารถปรับเปลี่ยนสถานะนักเรียน แล้วกด <strong>"บันทึกการแก้ไข"</strong> เพื่อปรับปรุงข้อมูล ${existingEntries.length} คาบพร้อมกันได้</div>
              </div>
            </div>
            ${isTeacherOrAdmin ? `
              <button id="btn-delete-current-att" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 font-sarabun">
                <span>🗑️</span> ลบรายการเช็กชื่อ (${existingEntries.length} คาบ)
              </button>
            ` : ''}
          </div>
        ` : ''}

        <!-- Filter Controls with Multi-Period Selector -->
        <div class="glass-card p-5 rounded-2xl space-y-4 bg-white border border-slate-200 font-sarabun">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">วันที่เช็กชื่อ</label>
              <input type="date" id="att-date" value="${this.attendanceDate}" class="input-field py-1.5 text-xs font-sarabun">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">รายวิชา</label>
              <select id="att-course" class="input-field py-1.5 text-xs font-sarabun">
                ${courses.map(c => `<option value="${c.id}" ${this.selectedCourseId === c.id ? 'selected' : ''}>${c.code} ${c.name}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ระดับชั้น / ห้อง (ดึงจากระบบ)</label>
              <div class="flex gap-2">
                <select id="att-grade" class="input-field py-1.5 text-xs font-sarabun">
                  ${availableGrades.map(g => `<option value="${g}" ${this.selectedGrade === g ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
                <select id="att-room" class="input-field py-1.5 text-xs font-sarabun">
                  ${availableRooms.map(r => `<option value="${r}" ${this.selectedRoom === r ? 'selected' : ''}>ห้อง ${r}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Multi-Period Interactive Pill Buttons -->
          <div class="pt-3 border-t border-slate-100">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label class="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>⏱️</span> เลือกคาบเรียน (คลิกเลือกหลายคาบพร้อมกันได้ กรณีสอน 2-3 คาบติด):
              </label>
              <span class="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                เลือกเช็กชื่อ ${this.selectedPeriods.length} คาบพร้อมกัน
              </span>
            </div>

            <div class="flex flex-wrap gap-2">
              ${PERIOD_OPTIONS.map((p, idx) => {
                const isSelected = this.selectedPeriods.includes(p);
                const periodNum = idx + 1;
                const timeRange = p.match(/\((.*?)\)/)?.[1] || '';
                return `
                  <button type="button" data-period-btn="${p}" class="px-3.5 py-2 rounded-xl text-xs font-bold font-sarabun transition-all flex items-center gap-1.5 shadow-2xs border ${
                    isSelected 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20 ring-2 ring-indigo-200 scale-[1.02]' 
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                  }">
                    <span class="w-4.5 h-4.5 rounded-full ${isSelected ? 'bg-white text-indigo-700 font-extrabold' : 'bg-slate-200 text-slate-600'} text-[10px] flex items-center justify-center">
                      ${isSelected ? '✓' : periodNum}
                    </span>
                    <span>คาบที่ ${periodNum}</span>
                    <span class="text-[11px] font-normal ${isSelected ? 'text-indigo-100' : 'text-slate-500'}">(${timeRange})</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Attendance Register Table -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200 font-sarabun">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse font-sarabun">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-sarabun font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-4 text-center">เลขที่</th>
                  <th class="p-4">รหัสนักเรียน</th>
                  <th class="p-4">ชื่อ-นามสกุล</th>
                  <th class="p-4 text-center">ชั้น / ห้อง</th>
                  <th class="p-4 text-center">สถานะการเข้าเรียน (${this.selectedPeriods.length} คาบ)</th>
                  <th class="p-4 text-center">ประวัติ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm font-sarabun">
                ${students.length === 0 ? `
                  <tr><td colspan="6" class="text-center py-12 text-slate-400 font-sarabun">ไม่พบรายชื่อนักเรียนในระดับชั้นและห้องเรียนที่เลือก</td></tr>
                ` : students.map(s => {
                  const currentStatus = recordsState[s.studentId] || 'Present';
                  return `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="p-4 text-center font-bold text-slate-800">${s.no || '-'}</td>
                      <td class="p-4 font-mono text-indigo-600 font-bold">${s.studentId}</td>
                      <td class="p-4 font-medium text-slate-900">${decodeMojibakeThai(s.name)}</td>
                      <td class="p-4 text-center">
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-md font-bold font-sarabun">
                          ${s.grade} / ห้อง ${s.room}
                        </span>
                      </td>
                      <td class="p-4 text-center">
                        <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1" data-student-status="${s.studentId}">
                          <button type="button" data-status="Present" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all ${
                            currentStatus === 'Present' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🟢 มา</button>

                          <button type="button" data-status="Late" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all ${
                            currentStatus === 'Late' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🟡 สาย</button>

                          <button type="button" data-status="Leave" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all ${
                            currentStatus === 'Leave' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🔵 ลา</button>

                          <button type="button" data-status="Absent" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all ${
                            currentStatus === 'Absent' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🔴 ขาด</button>
                        </div>
                      </td>
                      <td class="p-4 text-center">
                        <button type="button" data-view-student-att="${s.studentId}" data-student-name="${decodeMojibakeThai(s.name)}" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all inline-flex items-center gap-1 font-sarabun">
                          📊 ดูประวัติ
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Multi-Period Pill Selector Buttons Binding
    containerEl.querySelectorAll('[data-period-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const periodVal = e.currentTarget.dataset.periodBtn;
        const index = this.selectedPeriods.indexOf(periodVal);

        if (index >= 0) {
          if (this.selectedPeriods.length > 1) {
            this.selectedPeriods.splice(index, 1);
          }
        } else {
          this.selectedPeriods.push(periodVal);
          this.selectedPeriods.sort((a, b) => PERIOD_OPTIONS.indexOf(a) - PERIOD_OPTIONS.indexOf(b));
        }

        this.render(containerEl);
      });
    });

    // Filter Change Event Handlers
    containerEl.querySelector('#att-date')?.addEventListener('change', (e) => {
      this.attendanceDate = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#att-course')?.addEventListener('change', (e) => {
      this.selectedCourseId = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#att-grade')?.addEventListener('change', (e) => {
      this.selectedGrade = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#att-room')?.addEventListener('change', (e) => {
      this.selectedRoom = e.target.value;
      this.render(containerEl);
    });

    // Delete Current Attendance Session Handler
    containerEl.querySelector('#btn-delete-current-att')?.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: '🗑️ ยืนยันการลบรายการเช็กชื่อ',
        message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายการเช็กชื่อประจำวันที่ ${formatDateThai(this.attendanceDate)} สำหรับทั้ง ${existingEntries.length} คาบที่เลือก?`,
        confirmText: 'ลบรายการเช็กชื่อ',
        cancelText: 'ยกเลิก'
      });

      if (confirmed && existingEntries.length > 0) {
        existingEntries.forEach(entry => {
          firebaseService.deleteItem('attendance', entry.id);
        });
        await showAlertModal({
          title: '🗑️ ลบข้อมูลสำเร็จ',
          message: `ลบรายการเช็กชื่อประจำคาบที่เลือกเรียบร้อยแล้ว`,
          type: 'success'
        });
        this.render(containerEl);
      }
    });

    // Report Modal Event Handler
    containerEl.querySelector('#btn-view-att-report')?.addEventListener('click', () => {
      this.showAttendanceReportModal(attendanceList, users, courses, containerEl);
    });

    // Individual Student History Handler
    containerEl.querySelectorAll('[data-view-student-att]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stdId = e.currentTarget.dataset.viewStudentAtt;
        const std = studentUsers.find(u => u.studentId === stdId);
        if (std) {
          this.showStudentAttendanceDetailModal(std, attendanceList, courses, containerEl);
        }
      });
    });

    // Toggle Button Event Handlers
    containerEl.querySelectorAll('[data-student-status]').forEach(group => {
      const studentId = group.dataset.studentStatus;
      group.querySelectorAll('.att-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const status = e.currentTarget.dataset.status;
          recordsState[studentId] = status;

          group.querySelectorAll('.att-status-btn').forEach(b => {
            b.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all text-slate-600 hover:text-slate-900';
          });

          if (status === 'Present') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-emerald-600 text-white shadow-sm';
          else if (status === 'Late') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-amber-500 text-white shadow-sm';
          else if (status === 'Leave') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-blue-500 text-white shadow-sm';
          else if (status === 'Absent') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-rose-600 text-white shadow-sm';
        });
      });
    });

    // Bulk Present Handler
    containerEl.querySelector('#btn-bulk-present')?.addEventListener('click', () => {
      students.forEach(s => { recordsState[s.studentId] = 'Present'; });
      this.render(containerEl);
    });

    // Save Attendance Handler (Multi-Period Batch Save)
    containerEl.querySelector('#btn-save-attendance')?.addEventListener('click', async () => {
      if (this.selectedPeriods.length === 0) {
        await showAlertModal({ title: '⚠️ โปรดเลือกคาบเรียน', message: 'กรุณาเลือกคาบเรียนอย่างน้อย 1 คาบก่อนบันทึก' });
        return;
      }

      this.selectedPeriods.forEach(period => {
        const existing = attendanceList.find(a => 
          a.date === this.attendanceDate && 
          a.courseId === this.selectedCourseId && 
          a.period === period
        );

        const payload = {
          date: this.attendanceDate,
          courseId: this.selectedCourseId,
          grade: this.selectedGrade,
          room: this.selectedRoom,
          period: period,
          records: recordsState
        };

        if (existing) {
          firebaseService.updateItem('attendance', existing.id, payload);
        } else {
          firebaseService.addItem('attendance', payload);
        }
      });

      const periodNums = this.selectedPeriods.map(p => {
        const idx = PERIOD_OPTIONS.indexOf(p);
        return idx >= 0 ? `คาบที่ ${idx + 1}` : p;
      }).join(', ');

      await showAlertModal({
        title: '💾 บันทึกการเช็กชื่อสำเร็จ',
        message: `บันทึกเวลาเรียนสำหรับนักเรียน ${students.length} คน ใน ${periodNums} (รวม ${this.selectedPeriods.length} คาบ) เรียบร้อยแล้ว`,
        type: 'success'
      });
      this.render(containerEl);
    });
  }

  // Official Government Daily Attendance Detailed Report & Session Management Modal (TH Sarabun Typography)
  showAttendanceReportModal(attendanceList, users, courses, mainContainerEl) {
    const studentUsers = users.filter(u => u.role === 'Student');
    const availableGrades = [...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))].sort();
    if (availableGrades.length === 0) availableGrades.push('ม.1', 'ม.2', 'ม.3');

    let currentTab = 'daily'; // 'daily' | 'stats' | 'manage_sessions'
    let dailyDate = this.attendanceDate;
    let dailyCourseId = this.selectedCourseId !== 'All' ? this.selectedCourseId : (courses[0] ? courses[0].id : 'All');
    let dailyPeriod = this.selectedPeriods && this.selectedPeriods.length > 0 ? this.selectedPeriods[0] : PERIOD_OPTIONS[0];
    let rptGrade = this.selectedGrade !== 'All' ? this.selectedGrade : (availableGrades[0] || 'ม.1');
    let filterStatus = 'ALL'; // 'ALL' | 'Present' | 'Late' | 'Leave' | 'Absent'
    
    const getRooms = (g) => {
      const rooms = [...new Set(studentUsers.filter(s => s.grade === g).map(s => s.room).filter(r => r && r !== '-'))].sort();
      return rooms.length > 0 ? rooms : ['1'];
    };

    let rptRoom = getRooms(rptGrade)[0] || '1';

    const modalHTML = `
      <div id="att-report-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-5xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[92vh] flex flex-col space-y-4 font-sarabun">
          
          <!-- Header Bar -->
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-3">
              <img src="./logo.jpg" class="w-10 h-10 object-contain rounded-xl border border-slate-200 p-0.5">
              <div>
                <h3 class="text-xl font-bold font-sarabun text-slate-900 leading-tight">แบบรายงานสรุปข้อมูลการเข้าเรียน (Official Attendance Report)</h3>
                <p class="text-xs text-slate-500 font-sarabun">โรงเรียนพรมเทพพิทยาคม — ระบบรายงานสรุปผลรายวัน ฟอนต์ราชการ Sarabun</p>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <button id="btn-print-att-report" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-sarabun font-semibold flex items-center gap-1.5">
                <span>🖨️</span> พิมพ์รายงาน (PDF)
              </button>
              <button id="close-att-report-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">✕</button>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <div class="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-200 shrink-0 font-sarabun">
            <div class="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              <button id="tab-btn-daily" class="px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-indigo-600 text-white shadow-xs">
                📅 รายงานสรุปรายวัน (Daily Detailed)
              </button>
              <button id="tab-btn-stats" class="px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all text-slate-600 hover:bg-slate-100">
                📊 สถิติอัตราเข้าเรียนรวม
              </button>
              <button id="tab-btn-manage" class="px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all text-slate-600 hover:bg-slate-100">
                📋 จัดการบันทึกย้อนหลัง (${attendanceList.length})
              </button>
            </div>

            <div id="rpt-global-grade-controls" class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-700 font-sarabun">ชั้น/ห้อง:</label>
              <select id="rpt-grade-select" class="input-field py-1 text-xs w-24 font-sarabun">
                ${availableGrades.map(g => `<option value="${g}" ${rptGrade === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
              <select id="rpt-room-select" class="input-field py-1 text-xs w-20 font-sarabun"></select>
            </div>
          </div>

          <!-- Dynamic Content Body (Daily Report / Overall Stats / Session Log Management) -->
          <div id="rpt-content-body" class="flex-1 overflow-y-auto space-y-4 font-sarabun pr-1">
            <!-- Dynamically populated -->
          </div>

          <!-- Footer -->
          <div class="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 shrink-0 font-sarabun">
            <span>© 2026 โรงเรียนพรมเทพพิทยาคม — ระบบเช็กชื่อรายคาบเรียนยุคใหม่</span>
            <button id="close-att-report-btn" class="btn-primary px-5 py-2 rounded-xl text-xs font-bold font-sarabun">ปิดหน้าต่าง</button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('att-report-modal');
    const tabDailyBtn = modalEl.querySelector('#tab-btn-daily');
    const tabStatsBtn = modalEl.querySelector('#tab-btn-stats');
    const tabManageBtn = modalEl.querySelector('#tab-btn-manage');
    const gradeSelect = modalEl.querySelector('#rpt-grade-select');
    const roomSelect = modalEl.querySelector('#rpt-room-select');
    const contentBody = modalEl.querySelector('#rpt-content-body');

    const updateRoomDropdown = () => {
      const rooms = getRooms(gradeSelect.value);
      roomSelect.innerHTML = rooms.map(r => `<option value="${r}">ห้อง ${r}</option>`).join('');
      rptRoom = rooms[0] || '1';
    };

    const renderContent = () => {
      const currentAttendanceList = firebaseService.getCollection('attendance');

      // Highlight active tab
      tabDailyBtn.className = currentTab === 'daily' ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-indigo-600 text-white shadow-xs' : 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all text-slate-600 hover:bg-slate-100';
      tabStatsBtn.className = currentTab === 'stats' ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-indigo-600 text-white shadow-xs' : 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all text-slate-600 hover:bg-slate-100';
      tabManageBtn.className = currentTab === 'manage_sessions' ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all bg-indigo-600 text-white shadow-xs' : 'px-3.5 py-1.5 rounded-lg text-xs font-bold font-sarabun transition-all text-slate-600 hover:bg-slate-100';

      rptGrade = gradeSelect.value;
      rptRoom = roomSelect.value;

      const targetStudents = studentUsers
        .filter(s => s.grade === rptGrade && s.room === rptRoom)
        .sort((a, b) => (parseInt(a.no, 10) || 999) - (parseInt(b.no, 10) || 999));

      if (currentTab === 'daily') {
        // Tab 1: Daily Attendance Detailed Official Report
        const targetCourseObj = courses.find(c => c.id === dailyCourseId);

        // Find attendance entries matching daily filter criteria
        const matchingEntries = currentAttendanceList.filter(entry => {
          const matchDate = !dailyDate || entry.date === dailyDate;
          const matchCourse = dailyCourseId === 'All' || entry.courseId === dailyCourseId;
          const matchPeriod = dailyPeriod === 'All' || entry.period === dailyPeriod;
          const matchGrade = !entry.grade || entry.grade === rptGrade;
          const matchRoom = !entry.room || entry.room === rptRoom;
          return matchDate && matchCourse && matchPeriod && matchGrade && matchRoom;
        });

        // Compute status per student for selected day/period
        let dayPresentCount = 0, dayLateCount = 0, dayLeaveCount = 0, dayAbsentCount = 0;

        const studentDailyRecords = targetStudents.map(s => {
          let dayStatus = 'Unchecked';
          let totalChecked = 0;
          let presentCount = 0;

          // Check entries
          matchingEntries.forEach(entry => {
            if (entry.records && entry.records[s.studentId]) {
              dayStatus = entry.records[s.studentId];
            }
          });

          // Overall checked stats for notes
          currentAttendanceList.forEach(entry => {
            if (entry.records && entry.records[s.studentId]) {
              totalChecked++;
              if (entry.records[s.studentId] === 'Present' || entry.records[s.studentId] === 'Late') presentCount++;
            }
          });

          if (dayStatus === 'Present') dayPresentCount++;
          else if (dayStatus === 'Late') dayLateCount++;
          else if (dayStatus === 'Leave') dayLeaveCount++;
          else if (dayStatus === 'Absent') dayAbsentCount++;

          return {
            ...s,
            dayStatus,
            totalChecked,
            presentCount
          };
        });

        // Apply quick status filter pills
        const displayStudents = studentDailyRecords.filter(s => {
          if (filterStatus === 'ALL') return true;
          return s.dayStatus === filterStatus;
        });

        contentBody.innerHTML = `
          <!-- Daily Filter Toolbar -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl font-sarabun">
            <div>
              <label class="block text-[11px] font-bold text-indigo-900 mb-1">📅 เลือกวันที่:</label>
              <input type="date" id="daily-date-input" value="${dailyDate}" class="input-field py-1 text-xs font-sarabun">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-indigo-900 mb-1">📚 เลือกรายวิชา:</label>
              <select id="daily-course-select" class="input-field py-1 text-xs font-sarabun">
                <option value="All" ${dailyCourseId === 'All' ? 'selected' : ''}>🌐 ทุกรายวิชาที่สอน</option>
                ${courses.map(c => `<option value="${c.id}" ${dailyCourseId === c.id ? 'selected' : ''}>${c.code} ${c.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-indigo-900 mb-1">⏱️ คาบเรียน:</label>
              <select id="daily-period-select" class="input-field py-1 text-xs font-sarabun">
                <option value="All" ${dailyPeriod === 'All' ? 'selected' : ''}>🌐 ทุกคาบเรียน (คาบ 1-7)</option>
                ${PERIOD_OPTIONS.map(p => `<option value="${p}" ${dailyPeriod === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Official Government Daily Report Card -->
          <div class="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm font-sarabun text-slate-900 space-y-4">
            <!-- Report Header -->
            <div class="text-center border-b border-slate-200 pb-4 space-y-1">
              <div class="flex items-center justify-center gap-3 mb-1">
                <img src="./logo.jpg" class="w-14 h-14 object-contain rounded-xl border border-slate-200 p-0.5 shadow-xs">
                <div class="text-left">
                  <h3 class="text-xl font-bold text-slate-900 tracking-tight font-sarabun">โรงเรียนพรมเทพพิทยาคม</h3>
                  <p class="text-xs font-semibold text-slate-600 font-sarabun">แบบบันทึกรายงานสรุปการเข้าเรียนรายวัน (Daily Attendance Official Report)</p>
                </div>
              </div>
              
              <div class="flex flex-wrap justify-center items-center gap-x-6 gap-y-1 text-xs font-medium text-slate-700 pt-2 border-t border-dashed border-slate-200 font-sarabun">
                <span><strong>📅 ประจำวันที่:</strong> ${formatDateThai(dailyDate)}</span>
                <span><strong>📚 รายวิชา:</strong> ${targetCourseObj ? `${targetCourseObj.code} ${targetCourseObj.name}` : 'ทุกรายวิชา'}</span>
                <span><strong>🏫 ระดับชั้น:</strong> ${rptGrade} / ห้อง ${rptRoom}</span>
                <span><strong>⏱️ คาบเรียน:</strong> ${dailyPeriod === 'All' ? 'ทุกคาบเรียน (คาบ 1-7)' : dailyPeriod}</span>
              </div>
            </div>

            <!-- Summary Stats Pills -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div class="p-3 bg-slate-100 rounded-xl text-center border border-slate-200">
                <div class="text-[11px] font-bold text-slate-600">👥 นักเรียนทั้งหมด</div>
                <div class="text-xl font-extrabold text-slate-900 mt-0.5 font-sarabun">${targetStudents.length} <span class="text-xs font-normal">คน</span></div>
              </div>
              <div class="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                <div class="text-[11px] font-bold text-emerald-800">🟢 มาเรียน</div>
                <div class="text-xl font-extrabold text-emerald-700 mt-0.5 font-sarabun">${dayPresentCount} <span class="text-xs font-normal">คน</span></div>
              </div>
              <div class="p-3 bg-amber-50 rounded-xl text-center border border-amber-100">
                <div class="text-[11px] font-bold text-amber-800">🟡 มาสาย</div>
                <div class="text-xl font-extrabold text-amber-700 mt-0.5 font-sarabun">${dayLateCount} <span class="text-xs font-normal">คน</span></div>
              </div>
              <div class="p-3 bg-sky-50 rounded-xl text-center border border-sky-100">
                <div class="text-[11px] font-bold text-sky-800">🔵 ลากิจ/ลาป่วย</div>
                <div class="text-xl font-extrabold text-sky-700 mt-0.5 font-sarabun">${dayLeaveCount} <span class="text-xs font-normal">คน</span></div>
              </div>
              <div class="p-3 bg-rose-50 rounded-xl text-center border border-rose-100">
                <div class="text-[11px] font-bold text-rose-800">🔴 ขาดเรียน</div>
                <div class="text-xl font-extrabold text-rose-700 mt-0.5 font-sarabun">${dayAbsentCount} <span class="text-xs font-normal">คน</span></div>
              </div>
            </div>

            <!-- Quick Status Filter Pills -->
            <div class="flex items-center gap-2 text-xs font-bold pt-1 font-sarabun">
              <span class="text-slate-500">แสดงเฉพาะ:</span>
              <button type="button" data-filter-status="ALL" class="px-2.5 py-1 rounded-lg border text-xs transition-all ${filterStatus === 'ALL' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-200'}">
                ทั้งหมด (${targetStudents.length})
              </button>
              <button type="button" data-filter-status="Present" class="px-2.5 py-1 rounded-lg border text-xs transition-all ${filterStatus === 'Present' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}">
                🟢 มา (${dayPresentCount})
              </button>
              <button type="button" data-filter-status="Late" class="px-2.5 py-1 rounded-lg border text-xs transition-all ${filterStatus === 'Late' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-800 border-amber-200'}">
                🟡 สาย (${dayLateCount})
              </button>
              <button type="button" data-filter-status="Leave" class="px-2.5 py-1 rounded-lg border text-xs transition-all ${filterStatus === 'Leave' ? 'bg-sky-600 text-white border-sky-600' : 'bg-sky-50 text-sky-800 border-sky-200'}">
                🔵 ลา (${dayLeaveCount})
              </button>
              <button type="button" data-filter-status="Absent" class="px-2.5 py-1 rounded-lg border text-xs transition-all ${filterStatus === 'Absent' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-800 border-rose-200'}">
                🔴 ขาด (${dayAbsentCount})
              </button>
            </div>

            <!-- Official Table with Sarabun Font -->
            <div class="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table class="w-full text-left border-collapse font-sarabun">
                <thead>
                  <tr class="bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <th class="p-3 text-center border-r border-slate-200 w-12">เลขที่</th>
                    <th class="p-3 border-r border-slate-200 w-28">รหัสนักเรียน</th>
                    <th class="p-3 border-r border-slate-200">ชื่อ - นามสกุล</th>
                    <th class="p-3 text-center border-r border-slate-200 w-24">ชั้น/ห้อง</th>
                    <th class="p-3 text-center border-r border-slate-200 w-36">สถานะการเข้าเรียน</th>
                    <th class="p-3 text-center w-28">สถิติสะสม</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs font-sarabun">
                  ${displayStudents.length === 0 ? `
                    <tr><td colspan="6" class="text-center py-10 text-slate-400 font-sarabun">ไม่พบรายชื่อนักเรียนตามสถานะที่เลือก</td></tr>
                  ` : displayStudents.map(st => `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="p-3 text-center font-bold text-slate-800 border-r border-slate-100">${st.no || '-'}</td>
                      <td class="p-3 font-mono font-bold text-indigo-600 border-r border-slate-100">${st.studentId}</td>
                      <td class="p-3 font-semibold text-slate-900 border-r border-slate-100">${decodeMojibakeThai(st.name)}</td>
                      <td class="p-3 text-center border-r border-slate-100 font-bold text-slate-700">${st.grade}/${st.room}</td>
                      <td class="p-3 text-center border-r border-slate-100">
                        <span class="px-3 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                          st.dayStatus === 'Present' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          st.dayStatus === 'Late' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          st.dayStatus === 'Leave' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                          st.dayStatus === 'Absent' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }">
                          ${
                            st.dayStatus === 'Present' ? '🟢 มาเรียน' :
                            st.dayStatus === 'Late' ? '🟡 มาสาย' :
                            st.dayStatus === 'Leave' ? '🔵 ลากิจ/ลาป่วย' :
                            st.dayStatus === 'Absent' ? '🔴 ขาดเรียน' :
                            '⚪ ยังไม่เช็กชื่อ'
                          }
                        </span>
                      </td>
                      <td class="p-3 text-center font-bold text-slate-600">
                        ${st.presentCount}/${st.totalChecked} คาบ
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

        // Bind daily filter changes
        contentBody.querySelector('#daily-date-input')?.addEventListener('change', (e) => {
          dailyDate = e.target.value;
          renderContent();
        });

        contentBody.querySelector('#daily-course-select')?.addEventListener('change', (e) => {
          dailyCourseId = e.target.value;
          renderContent();
        });

        contentBody.querySelector('#daily-period-select')?.addEventListener('change', (e) => {
          dailyPeriod = e.target.value;
          renderContent();
        });

        contentBody.querySelectorAll('[data-filter-status]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            filterStatus = e.currentTarget.dataset.filterStatus;
            renderContent();
          });
        });

      } else if (currentTab === 'stats') {
        // Tab 2: Overall Attendance Rate Stats
        let totalPresent = 0, totalLate = 0, totalLeave = 0, totalAbsent = 0;

        const studentStats = targetStudents.map(s => {
          let present = 0, late = 0, leave = 0, absent = 0;

          currentAttendanceList.forEach(entry => {
            if (entry.records && entry.records[s.studentId]) {
              const st = entry.records[s.studentId];
              if (st === 'Present') present++;
              else if (st === 'Late') late++;
              else if (st === 'Leave') leave++;
              else if (st === 'Absent') absent++;
            }
          });

          totalPresent += present;
          totalLate += late;
          totalLeave += leave;
          totalAbsent += absent;

          const totalChecked = present + late + leave + absent;
          const rate = totalChecked > 0 ? Math.round(((present + late) / totalChecked) * 100) : 100;

          return {
            ...s,
            present,
            late,
            leave,
            absent,
            totalChecked,
            rate
          };
        });

        contentBody.innerHTML = `
          <!-- Stats Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sarabun">
            <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
              <div class="text-xs font-bold text-emerald-800">🟢 มาเรียนรวม</div>
              <div class="text-2xl font-extrabold text-emerald-700 font-sarabun mt-1">${totalPresent} <span class="text-xs font-normal">ครั้ง</span></div>
            </div>
            <div class="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
              <div class="text-xs font-bold text-amber-800">🟡 มาสายรวม</div>
              <div class="text-2xl font-extrabold text-amber-700 font-sarabun mt-1">${totalLate} <span class="text-xs font-normal">ครั้ง</span></div>
            </div>
            <div class="p-4 rounded-2xl bg-sky-50 border border-sky-100 text-center">
              <div class="text-xs font-bold text-sky-800">🔵 ลากิจ/ลาป่วย</div>
              <div class="text-2xl font-extrabold text-sky-700 font-sarabun mt-1">${totalLeave} <span class="text-xs font-normal">ครั้ง</span></div>
            </div>
            <div class="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center">
              <div class="text-xs font-bold text-rose-800">🔴 ขาดเรียนรวม</div>
              <div class="text-2xl font-extrabold text-rose-700 font-sarabun mt-1">${totalAbsent} <span class="text-xs font-normal">ครั้ง</span></div>
            </div>
          </div>

          <!-- Student Attendance Matrix Table -->
          <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white font-sarabun">
            <table class="w-full text-left border-collapse font-sarabun">
              <thead>
                <tr class="bg-slate-100 text-slate-800 text-xs font-bold uppercase border-b border-slate-200">
                  <th class="p-3 text-center">เลขที่</th>
                  <th class="p-3">รหัสนักเรียน</th>
                  <th class="p-3">ชื่อ-นามสกุล</th>
                  <th class="p-3 text-center">🟢 มา</th>
                  <th class="p-3 text-center">🟡 สาย</th>
                  <th class="p-3 text-center">🔵 ลา</th>
                  <th class="p-3 text-center">🔴 ขาด</th>
                  <th class="p-3 text-center">อัตราเข้าเรียน</th>
                  <th class="p-3 text-center">ประวัติ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs font-sarabun">
                ${studentStats.length === 0 ? `
                  <tr><td colspan="9" class="text-center py-8 text-slate-400 font-sarabun">ไม่พบข้อมูลนักเรียนในห้องนี้</td></tr>
                ` : studentStats.map(st => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center font-bold text-slate-800">${st.no || '-'}</td>
                    <td class="p-3 font-mono font-bold text-indigo-600">${st.studentId}</td>
                    <td class="p-3 font-medium text-slate-900">${decodeMojibakeThai(st.name)}</td>
                    <td class="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50">${st.present}</td>
                    <td class="p-3 text-center font-bold text-amber-700 bg-amber-50/50">${st.late}</td>
                    <td class="p-3 text-center font-bold text-sky-700 bg-sky-50/50">${st.leave}</td>
                    <td class="p-3 text-center font-bold text-rose-700 bg-rose-50/50">${st.absent}</td>
                    <td class="p-3 text-center">
                      <span class="px-2.5 py-1 rounded-full font-bold text-[11px] ${
                        st.rate >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }">
                        ${st.rate}%
                      </span>
                    </td>
                    <td class="p-3 text-center">
                      <button type="button" data-rpt-student-id="${st.studentId}" class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline font-sarabun">
                        🔍 รายละเอียด
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

        contentBody.querySelectorAll('[data-rpt-student-id]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const stdId = e.currentTarget.dataset.rptStudentId;
            const std = studentUsers.find(u => u.studentId === stdId);
            if (std) this.showStudentAttendanceDetailModal(std, currentAttendanceList, courses, mainContainerEl);
          });
        });
      } else {
        // Tab 3: Manage Recorded Attendance Sessions
        const sortedLogs = [...currentAttendanceList].sort((a, b) => new Date(b.date) - new Date(a.date));

        contentBody.innerHTML = `
          <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white font-sarabun">
            <table class="w-full text-left border-collapse text-xs font-sarabun">
              <thead>
                <tr class="bg-slate-100 text-slate-800 font-bold uppercase border-b border-slate-200">
                  <th class="p-3">วันที่เช็กชื่อ</th>
                  <th class="p-3">รายวิชา</th>
                  <th class="p-3 text-center">ชั้น / ห้อง</th>
                  <th class="p-3">คาบเรียน</th>
                  <th class="p-3 text-center">นักเรียนที่เช็กชื่อ</th>
                  <th class="p-3 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-sarabun">
                ${sortedLogs.length === 0 ? `
                  <tr><td colspan="6" class="text-center py-10 text-slate-400 font-sarabun">ยังไม่มีบันทึกประวัติการเช็กชื่อในระบบ</td></tr>
                ` : sortedLogs.map(log => {
                  const course = courses.find(c => c.id === log.courseId);
                  const checkedCount = log.records ? Object.keys(log.records).length : 0;
                  return `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="p-3 font-mono font-bold text-slate-800">${formatDateThai(log.date)}</td>
                      <td class="p-3 font-medium text-indigo-700">${course ? `${course.code} ${course.name}` : 'วิชาทั่วไป'}</td>
                      <td class="p-3 text-center font-bold text-slate-700">${log.grade || '-'} / ห้อง ${log.room || '-'}</td>
                      <td class="p-3 font-medium text-slate-800">${log.period}</td>
                      <td class="p-3 text-center font-bold text-emerald-700">${checkedCount} คน</td>
                      <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          <button type="button" data-edit-log-id="${log.id}" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-200 transition-all font-sarabun">
                            ✏️ แก้ไข
                          </button>
                          <button type="button" data-del-log-id="${log.id}" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition-all font-sarabun">
                            🗑️ ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;

        // Bind Edit & Delete buttons for logs
        contentBody.querySelectorAll('[data-edit-log-id]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const logId = e.currentTarget.dataset.editLogId;
            const targetLog = currentAttendanceList.find(l => l.id === logId);
            if (targetLog) {
              this.attendanceDate = targetLog.date;
              this.selectedCourseId = targetLog.courseId;
              this.selectedGrade = targetLog.grade || 'ม.1';
              this.selectedRoom = targetLog.room || '1';
              this.selectedPeriods = [targetLog.period];
              modalEl.remove();
              if (mainContainerEl) this.render(mainContainerEl);
            }
          });
        });

        contentBody.querySelectorAll('[data-del-log-id]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const logId = e.currentTarget.dataset.delLogId;
            const targetLog = currentAttendanceList.find(l => l.id === logId);
            if (!targetLog) return;

            const confirmed = await showConfirmModal({
              title: '🗑️ ยืนยันการลบรายการเช็กชื่อ',
              message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายการเช็กชื่อประจำวันที่ ${formatDateThai(targetLog.date)} (${targetLog.period})?`,
              confirmText: 'ลบรายการเช็กชื่อ',
              cancelText: 'ยกเลิก'
            });

            if (confirmed) {
              firebaseService.deleteItem('attendance', logId);
              renderContent();
              if (mainContainerEl) this.render(mainContainerEl);
            }
          });
        });
      }
    };

    updateRoomDropdown();
    renderContent();

    tabDailyBtn.addEventListener('click', () => {
      currentTab = 'daily';
      renderContent();
    });

    tabStatsBtn.addEventListener('click', () => {
      currentTab = 'stats';
      renderContent();
    });

    tabManageBtn.addEventListener('click', () => {
      currentTab = 'manage_sessions';
      renderContent();
    });

    gradeSelect.addEventListener('change', () => {
      updateRoomDropdown();
      renderContent();
    });

    roomSelect.addEventListener('change', renderContent);

    modalEl.querySelector('#btn-print-att-report')?.addEventListener('click', () => {
      window.print();
    });

    modalEl.querySelectorAll('#close-att-report-modal, #close-att-report-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }

  // Individual Student Attendance History Breakdown Modal (With Edit & Delete Status Capabilities)
  showStudentAttendanceDetailModal(student, attendanceList, courses, mainContainerEl) {
    const currentUser = this.rbac.getCurrentUser();
    const isTeacherOrAdmin = currentUser.role === 'Teacher' || currentUser.role === 'Admin';

    const getStudentHistory = () => {
      const currentAttendanceList = firebaseService.getCollection('attendance');
      const history = [];

      currentAttendanceList.forEach(entry => {
        if (entry.records && entry.records[student.studentId]) {
          const course = courses.find(c => c.id === entry.courseId);
          history.push({
            entryId: entry.id,
            entryDate: entry.date,
            courseCode: course ? course.code : '',
            courseName: course ? course.name : 'วิชาทั่วไป',
            period: entry.period,
            status: entry.records[student.studentId]
          });
        }
      });

      return history.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
    };

    const modalHTML = `
      <div id="student-att-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in font-sarabun">
        <div class="glass-card w-full max-w-3xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[85vh] flex flex-col space-y-4 font-sarabun">
          
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-2.5">
              <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 text-lg">👤</span>
              <div>
                <h3 class="text-lg font-bold font-sarabun text-slate-900">ประวัติการเข้าเรียนส่วนบุคคล</h3>
                <p class="text-xs text-slate-500 font-sarabun">
                  นักเรียน: <strong class="text-indigo-900 font-bold">${decodeMojibakeThai(student.name)}</strong> (${student.studentId}) — ชั้น ${student.grade}/${student.room}
                </p>
              </div>
            </div>

            <button id="close-student-att-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <div id="std-history-container" class="flex-1 overflow-y-auto space-y-4 font-sarabun">
            <!-- Dynamically populated -->
          </div>

          <div class="pt-3 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            <button id="close-student-att-btn" class="btn-primary px-5 py-2 rounded-xl text-xs font-bold font-sarabun">ปิดหน้าต่าง</button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('student-att-modal');
    const container = modalEl.querySelector('#std-history-container');

    const renderStudentHistoryList = () => {
      const historyList = getStudentHistory();

      if (historyList.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 font-sarabun">ยังไม่มีประวัติการเช็กชื่อย้อนหลังสำหรับนักเรียนคนนี้</div>`;
        return;
      }

      container.innerHTML = `
        <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white font-sarabun">
          <table class="w-full text-left border-collapse text-xs font-sarabun">
            <thead>
              <tr class="bg-slate-50 text-slate-800 font-bold uppercase border-b border-slate-200">
                <th class="p-3">วันที่เช็กชื่อ</th>
                <th class="p-3">รายวิชา</th>
                <th class="p-3">คาบเรียน</th>
                <th class="p-3 text-center">สถานะการเข้าเรียน</th>
                ${isTeacherOrAdmin ? `<th class="p-3 text-center">การจัดการ</th>` : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-sarabun">
              ${historyList.map(h => `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-3 font-mono font-bold text-slate-700">${formatDateThai(h.entryDate)}</td>
                  <td class="p-3 font-medium text-slate-900">${h.courseCode} ${decodeMojibakeThai(h.courseName)}</td>
                  <td class="p-3 text-slate-600">${h.period}</td>
                  <td class="p-3 text-center">
                    ${isTeacherOrAdmin ? `
                      <select data-change-std-status="${h.entryId}" class="input-field py-1 px-2 text-xs font-bold rounded-lg border border-slate-200 font-sarabun">
                        <option value="Present" ${h.status === 'Present' ? 'selected' : ''}>🟢 มาเรียน</option>
                        <option value="Late" ${h.status === 'Late' ? 'selected' : ''}>🟡 มาสาย</option>
                        <option value="Leave" ${h.status === 'Leave' ? 'selected' : ''}>🔵 ลากิจ/ลาป่วย</option>
                        <option value="Absent" ${h.status === 'Absent' ? 'selected' : ''}>🔴 ขาดเรียน</option>
                      </select>
                    ` : `
                      <span class="px-2.5 py-1 rounded-md font-bold text-[11px] ${
                        h.status === 'Present' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        h.status === 'Late' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        h.status === 'Leave' ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }">
                        ${h.status === 'Present' ? '🟢 มา' : h.status === 'Late' ? '🟡 สาย' : h.status === 'Leave' ? '🔵 ลา' : '🔴 ขาด'}
                      </span>
                    `}
                  </td>
                  ${isTeacherOrAdmin ? `
                    <td class="p-3 text-center">
                      <button type="button" data-del-std-att="${h.entryId}" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition-all text-xs font-sarabun" title="ลบสถานะคาบนี้">
                        🗑️ ลบประวัติ
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Bind status dropdown changes for student history
      container.querySelectorAll('[data-change-std-status]').forEach(select => {
        select.addEventListener('change', (e) => {
          const entryId = e.currentTarget.dataset.changeStdStatus;
          const newStatus = e.target.value;
          const currentAttendanceList = firebaseService.getCollection('attendance');
          const entry = currentAttendanceList.find(l => l.id === entryId);

          if (entry && entry.records) {
            entry.records[student.studentId] = newStatus;
            firebaseService.updateItem('attendance', entryId, entry);
            if (mainContainerEl) this.render(mainContainerEl);
          }
        });
      });

      // Bind delete status handler
      container.querySelectorAll('[data-del-std-att]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const entryId = e.currentTarget.dataset.delStdAtt;
          const currentAttendanceList = firebaseService.getCollection('attendance');
          const entry = currentAttendanceList.find(l => l.id === entryId);

          if (!entry) return;

          const confirmed = await showConfirmModal({
            title: '🗑️ ยืนยันการลบประวัติการเข้าเรียน',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการเช็กชื่อของ "${decodeMojibakeThai(student.name)}" ในวันที่ ${formatDateThai(entry.date)} (${entry.period})?`,
            confirmText: 'ลบประวัติ',
            cancelText: 'ยกเลิก'
          });

          if (confirmed && entry.records) {
            delete entry.records[student.studentId];
            firebaseService.updateItem('attendance', entryId, entry);
            renderStudentHistoryList();
            if (mainContainerEl) this.render(mainContainerEl);
          }
        });
      });
    };

    renderStudentHistoryList();

    modalEl.querySelectorAll('#close-student-att-modal, #close-student-att-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }
}
