/**
 * Attendance Module
 * Period attendance register with 4-state status toggles (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴),
 * dynamic system grade/room loading, 9 period options (คาบที่ 1-9),
 * and comprehensive attendance analytics & report modal.
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal } from '../services/dialogService.js';

export const PERIOD_OPTIONS = [
  'คาบที่ 1 (08:40 - 09:30)',
  'คาบที่ 2 (09:30 - 10:20)',
  'คาบที่ 3 (10:20 - 11:10)',
  'คาบที่ 4 (11:10 - 12:00)',
  'คาบที่ 5 (13:00 - 13:50)',
  'คาบที่ 6 (13:50 - 14:40)',
  'คาบที่ 7 (14:40 - 15:30)',
];

export class AttendanceModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedCourseId = 'All';
    this.selectedGrade = 'ม.1';
    this.selectedRoom = '1';
    this.selectedPeriod = PERIOD_OPTIONS[0];
    this.attendanceDate = new Date().toISOString().substring(0, 10);
  }

  render(containerEl) {
    const courses = firebaseService.getCollection('courses');
    const users = firebaseService.getCollection('users');
    const attendanceList = firebaseService.getCollection('attendance');
    const currentUser = this.rbac.getCurrentUser();

    // 1. Dynamic Grade List from System Users DB
    const studentUsers = users.filter(u => u.role === 'Student');
    const availableGrades = [...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))].sort();
    if (availableGrades.length === 0) availableGrades.push('ม.1', 'ม.2', 'ม.3');

    if (this.selectedGrade !== 'All' && !availableGrades.includes(this.selectedGrade)) {
      this.selectedGrade = availableGrades[0] || 'ม.1';
    }

    // 2. Dynamic Room List based on Selected Grade
    const getRoomsForGrade = (targetGrade) => {
      let filtered = studentUsers;
      if (targetGrade !== 'All') {
        filtered = studentUsers.filter(s => s.grade === targetGrade);
      }
      const rooms = [...new Set(filtered.map(s => s.room).filter(r => r && r !== '-'))].sort();
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

    // Find existing attendance record for date + course + period
    const existingEntry = attendanceList.find(a => 
      a.date === this.attendanceDate && 
      a.courseId === this.selectedCourseId && 
      a.period === this.selectedPeriod
    );

    const recordsState = existingEntry ? { ...existingEntry.records } : {};

    // Fill defaults (Present) for missing students
    students.forEach(s => {
      if (!recordsState[s.studentId]) {
        recordsState[s.studentId] = 'Present';
      }
    });

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Header -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-3">
              <span class="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-xl">⏱️</span>
              เช็กชื่อรายคาบเรียน (Period Attendance Register)
            </h2>
            <p class="text-slate-500 text-xs mt-1 leading-relaxed">
              บันทึกเวลาเรียน 4 สถานะ (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴) คาบเรียนที่ 1-9 พร้อมดึงระดับชั้น/ห้องเรียนจากระบบสด 0.1s
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button id="btn-view-att-report" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-heading font-bold flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all">
              <span>📊</span> สรุปประวัติการเข้าเรียน
            </button>
            <button id="btn-bulk-present" class="btn-secondary text-xs px-3.5 py-2.5 rounded-xl font-heading font-semibold">
              🟢 มาเรียนทั้งหมด
            </button>
            <button id="btn-save-attendance" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-heading font-semibold shadow-md shadow-indigo-500/20">
              💾 บันทึกการเช็กชื่อ
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="glass-card p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white border border-slate-200">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">วันที่เช็กชื่อ</label>
            <input type="date" id="att-date" value="${this.attendanceDate}" class="input-field py-1.5 text-xs">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">รายวิชา</label>
            <select id="att-course" class="input-field py-1.5 text-xs">
              ${courses.map(c => `<option value="${c.id}" ${this.selectedCourseId === c.id ? 'selected' : ''}>${c.code} ${c.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">ระดับชั้น / ห้อง (ดึงจากระบบ)</label>
            <div class="flex gap-2">
              <select id="att-grade" class="input-field py-1.5 text-xs">
                ${availableGrades.map(g => `<option value="${g}" ${this.selectedGrade === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
              <select id="att-room" class="input-field py-1.5 text-xs">
                ${availableRooms.map(r => `<option value="${r}" ${this.selectedRoom === r ? 'selected' : ''}>ห้อง ${r}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">คาบเรียน (คาบ 1-9)</label>
            <select id="att-period" class="input-field py-1.5 text-xs">
              ${PERIOD_OPTIONS.map(p => `<option value="${p}" ${this.selectedPeriod === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Attendance Register Table -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-4 text-center">เลขที่</th>
                  <th class="p-4">รหัสนักเรียน</th>
                  <th class="p-4">ชื่อ-นามสกุล</th>
                  <th class="p-4 text-center">ชั้น / ห้อง</th>
                  <th class="p-4 text-center">สถานะการเข้าเรียน</th>
                  <th class="p-4 text-center">ประวัติ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${students.length === 0 ? `
                  <tr><td colspan="6" class="text-center py-12 text-slate-400">ไม่พบรายชื่อนักเรียนในระดับชั้นและห้องเรียนที่เลือก</td></tr>
                ` : students.map(s => {
                  const currentStatus = recordsState[s.studentId] || 'Present';
                  return `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="p-4 text-center font-bold text-slate-800">${s.no || '-'}</td>
                      <td class="p-4 font-mono text-indigo-600 font-bold">${s.studentId}</td>
                      <td class="p-4 font-medium text-slate-900">${decodeMojibakeThai(s.name)}</td>
                      <td class="p-4 text-center">
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-md font-bold font-heading">
                          ${s.grade} / ห้อง ${s.room}
                        </span>
                      </td>
                      <td class="p-4 text-center">
                        <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1" data-student-status="${s.studentId}">
                          <button type="button" data-status="Present" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Present' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🟢 มา</button>

                          <button type="button" data-status="Late" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Late' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🟡 สาย</button>

                          <button type="button" data-status="Leave" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Leave' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🔵 ลา</button>

                          <button type="button" data-status="Absent" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Absent' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🔴 ขาด</button>
                        </div>
                      </td>
                      <td class="p-4 text-center">
                        <button type="button" data-view-student-att="${s.studentId}" data-student-name="${decodeMojibakeThai(s.name)}" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all inline-flex items-center gap-1">
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
    containerEl.querySelector('#att-period')?.addEventListener('change', (e) => {
      this.selectedPeriod = e.target.value;
      this.render(containerEl);
    });

    // Report Modal Event Handler
    containerEl.querySelector('#btn-view-att-report')?.addEventListener('click', () => {
      this.showAttendanceReportModal(attendanceList, users, courses);
    });

    // Individual Student History Handler
    containerEl.querySelectorAll('[data-view-student-att]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stdId = e.currentTarget.dataset.viewStudentAtt;
        const std = studentUsers.find(u => u.studentId === stdId);
        if (std) {
          this.showStudentAttendanceDetailModal(std, attendanceList, courses);
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
            b.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all text-slate-600 hover:text-slate-900';
          });

          if (status === 'Present') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-emerald-600 text-white shadow-sm';
          else if (status === 'Late') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-amber-500 text-white shadow-sm';
          else if (status === 'Leave') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-blue-500 text-white shadow-sm';
          else if (status === 'Absent') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-rose-600 text-white shadow-sm';
        });
      });
    });

    // Bulk Present Handler
    containerEl.querySelector('#btn-bulk-present')?.addEventListener('click', () => {
      students.forEach(s => { recordsState[s.studentId] = 'Present'; });
      this.render(containerEl);
    });

    // Save Attendance Handler
    containerEl.querySelector('#btn-save-attendance')?.addEventListener('click', async () => {
      const payload = {
        date: this.attendanceDate,
        courseId: this.selectedCourseId,
        grade: this.selectedGrade,
        room: this.selectedRoom,
        period: this.selectedPeriod,
        records: recordsState
      };

      if (existingEntry) {
        firebaseService.updateItem('attendance', existingEntry.id, payload);
      } else {
        firebaseService.addItem('attendance', payload);
      }

      await showAlertModal({
        title: '💾 บันทึกการเช็กชื่อสำเร็จ',
        message: `บันทึกเวลาเรียนสำหรับนักเรียน ${students.length} คน เรียบร้อยแล้ว`,
        type: 'success'
      });
    });
  }

  // High-End Attendance Summary & Analytics Report Modal
  showAttendanceReportModal(attendanceList, users, courses) {
    const studentUsers = users.filter(u => u.role === 'Student');
    const availableGrades = [...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))].sort();
    if (availableGrades.length === 0) availableGrades.push('ม.1', 'ม.2', 'ม.3');

    let rptGrade = availableGrades[0] || 'ม.1';
    
    const getRooms = (g) => {
      const rooms = [...new Set(studentUsers.filter(s => s.grade === g).map(s => s.room).filter(r => r && r !== '-'))].sort();
      return rooms.length > 0 ? rooms : ['1'];
    };

    let rptRoom = getRooms(rptGrade)[0] || '1';

    const modalHTML = `
      <div id="att-report-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-4xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] flex flex-col space-y-5">
          
          <!-- Header -->
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-2.5">
              <span class="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 text-lg">📊</span>
              <div>
                <h3 class="text-xl font-bold font-heading text-slate-900">รายงานสรุปข้อมูลการเข้าเรียน (Attendance Analytics & Report)</h3>
                <p class="text-xs text-slate-500">สรุปสถิติอัตราการมาเรียน สาย ลา และขาดเรียนของนักเรียน</p>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <button id="btn-print-att-report" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-heading font-semibold flex items-center gap-1.5">
                <span>🖨️</span> พิมพ์รายงาน (PDF)
              </button>
              <button id="close-att-report-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">✕</button>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 shrink-0">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <label class="text-xs font-bold text-slate-700">ระดับชั้น:</label>
                <select id="rpt-grade-select" class="input-field py-1 text-xs w-28">
                  ${availableGrades.map(g => `<option value="${g}">${g}</option>`).join('')}
                </select>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-xs font-bold text-slate-700">ห้องเรียน:</label>
                <select id="rpt-room-select" class="input-field py-1 text-xs w-24"></select>
              </div>
            </div>

            <div class="text-xs font-semibold text-slate-500">
              จำนวนบันทึกเช็กชื่อรวมในระบบ: <strong class="text-indigo-600 font-bold">${attendanceList.length}</strong> คาบ
            </div>
          </div>

          <!-- Content Body (Analytics & Table) -->
          <div id="rpt-content-body" class="flex-1 overflow-y-auto space-y-5">
            <!-- Rendered dynamically -->
          </div>

          <!-- Footer -->
          <div class="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 shrink-0">
            <span>© 2026 Kruchock-Classroom — Realtime Period Attendance System</span>
            <button id="close-att-report-btn" class="btn-primary px-5 py-2 rounded-xl text-xs font-bold">ปิดหน้าต่าง</button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('att-report-modal');
    const gradeSelect = modalEl.querySelector('#rpt-grade-select');
    const roomSelect = modalEl.querySelector('#rpt-room-select');
    const contentBody = modalEl.querySelector('#rpt-content-body');

    const updateRoomDropdown = () => {
      const rooms = getRooms(gradeSelect.value);
      roomSelect.innerHTML = rooms.map(r => `<option value="${r}">ห้อง ${r}</option>`).join('');
      rptRoom = rooms[0] || '1';
    };

    const renderReportData = () => {
      rptGrade = gradeSelect.value;
      rptRoom = roomSelect.value;

      const targetStudents = studentUsers
        .filter(s => s.grade === rptGrade && s.room === rptRoom)
        .sort((a, b) => (parseInt(a.no, 10) || 999) - (parseInt(b.no, 10) || 999));

      // Calculate statistics per student
      let totalPresent = 0;
      let totalLate = 0;
      let totalLeave = 0;
      let totalAbsent = 0;

      const studentStats = targetStudents.map(s => {
        let present = 0, late = 0, leave = 0, absent = 0;

        attendanceList.forEach(entry => {
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

      const grandTotal = totalPresent + totalLate + totalLeave + totalAbsent;
      const overallRate = grandTotal > 0 ? Math.round(((totalPresent + totalLate) / grandTotal) * 100) : 100;

      contentBody.innerHTML = `
        <!-- Stats Bar -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
            <div class="text-xs font-bold text-emerald-800">🟢 มาเรียนรวม</div>
            <div class="text-2xl font-extrabold text-emerald-700 font-heading mt-1">${totalPresent} <span class="text-xs font-normal">ครั้ง</span></div>
          </div>
          <div class="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
            <div class="text-xs font-bold text-amber-800">🟡 มาสายรวม</div>
            <div class="text-2xl font-extrabold text-amber-700 font-heading mt-1">${totalLate} <span class="text-xs font-normal">ครั้ง</span></div>
          </div>
          <div class="p-4 rounded-2xl bg-sky-50 border border-sky-100 text-center">
            <div class="text-xs font-bold text-sky-800">🔵 ลากิจ/ลาป่วย</div>
            <div class="text-2xl font-extrabold text-sky-700 font-heading mt-1">${totalLeave} <span class="text-xs font-normal">ครั้ง</span></div>
          </div>
          <div class="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center">
            <div class="text-xs font-bold text-rose-800">🔴 ขาดเรียนรวม</div>
            <div class="text-2xl font-extrabold text-rose-700 font-heading mt-1">${totalAbsent} <span class="text-xs font-normal">ครั้ง</span></div>
          </div>
        </div>

        <!-- Student Attendance Matrix Table -->
        <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-800 text-xs font-heading font-bold uppercase border-b border-slate-200">
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
            <tbody class="divide-y divide-slate-100 text-xs">
              ${studentStats.length === 0 ? `
                <tr><td colspan="9" class="text-center py-8 text-slate-400">ไม่พบข้อมูลนักเรียนในห้องนี้</td></tr>
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
                    <button type="button" data-rpt-student-id="${st.studentId}" class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline">
                      🔍 รายละเอียด
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Bind detail button in report table
      contentBody.querySelectorAll('[data-rpt-student-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const stdId = e.currentTarget.dataset.rptStudentId;
          const std = studentUsers.find(u => u.studentId === stdId);
          if (std) this.showStudentAttendanceDetailModal(std, attendanceList, courses);
        });
      });
    };

    updateRoomDropdown();
    renderReportData();

    gradeSelect.addEventListener('change', () => {
      updateRoomDropdown();
      renderReportData();
    });

    roomSelect.addEventListener('change', renderReportData);

    modalEl.querySelector('#btn-print-att-report')?.addEventListener('click', () => {
      window.print();
    });

    modalEl.querySelectorAll('#close-att-report-modal, #close-att-report-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }

  // Individual Student Attendance History Breakdown Modal
  showStudentAttendanceDetailModal(student, attendanceList, courses) {
    const studentHistory = [];

    attendanceList.forEach(entry => {
      if (entry.records && entry.records[student.studentId]) {
        const course = courses.find(c => c.id === entry.courseId);
        studentHistory.push({
          date: entry.date,
          courseCode: course ? course.code : '',
          courseName: course ? course.name : 'วิชาทั่วไป',
          period: entry.period,
          status: entry.records[student.studentId]
        });
      }
    });

    studentHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    const modalHTML = `
      <div id="student-att-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-2xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[85vh] flex flex-col space-y-4">
          
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-2.5">
              <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 text-lg">👤</span>
              <div>
                <h3 class="text-lg font-bold font-heading text-slate-900">ประวัติการเข้าเรียนส่วนบุคคล</h3>
                <p class="text-xs text-slate-500 font-heading">
                  นักเรียน: <strong class="text-indigo-900 font-bold">${decodeMojibakeThai(student.name)}</strong> (${student.studentId}) — ชั้น ${student.grade}/${student.room}
                </p>
              </div>
            </div>

            <button id="close-student-att-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-4">
            ${studentHistory.length === 0 ? `
              <div class="text-center py-10 text-slate-400">ยังไม่มีประวัติการเช็กชื่อย้อนหลังสำหรับนักเรียนคนนี้</div>
            ` : `
              <div class="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="bg-slate-50 text-slate-800 font-bold uppercase border-b border-slate-200">
                      <th class="p-3">วันที่เช็กชื่อ</th>
                      <th class="p-3">รายวิชา</th>
                      <th class="p-3">คาบเรียน</th>
                      <th class="p-3 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${studentHistory.map(h => `
                      <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-3 font-mono font-bold text-slate-700">${h.date}</td>
                        <td class="p-3 font-medium text-slate-900">${h.courseCode} ${decodeMojibakeThai(h.courseName)}</td>
                        <td class="p-3 text-slate-600">${h.period}</td>
                        <td class="p-3 text-center">
                          <span class="px-2.5 py-1 rounded-md font-bold text-[11px] ${
                            h.status === 'Present' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            h.status === 'Late' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            h.status === 'Leave' ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }">
                            ${h.status === 'Present' ? '🟢 มา' : h.status === 'Late' ? '🟡 สาย' : h.status === 'Leave' ? '🔵 ลา' : '🔴 ขาด'}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <div class="pt-3 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            <button id="close-student-att-btn" class="btn-primary px-5 py-2 rounded-xl text-xs font-bold">ปิดหน้าต่าง</button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('student-att-modal');

    modalEl.querySelectorAll('#close-student-att-modal, #close-student-att-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }
}
