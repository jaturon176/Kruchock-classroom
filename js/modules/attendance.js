/**
 * Attendance Module
 * Period attendance register with 4-state status toggles (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴) and bulk toggles.
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal } from '../services/dialogService.js';

export class AttendanceModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedCourseId = 'crs_math';
    this.selectedGrade = 'ม.1';
    this.selectedRoom = '1';
    this.selectedPeriod = 'คาบที่ 1 (08:30 - 09:30)';
    this.attendanceDate = new Date().toISOString().substring(0, 10);
  }

  render(containerEl) {
    const courses = firebaseService.getCollection('courses');
    const users = firebaseService.getCollection('users');
    const attendanceList = firebaseService.getCollection('attendance');

    const students = users.filter(u => u.role === 'Student' && (this.selectedGrade === 'All' || u.grade === this.selectedGrade) && (this.selectedRoom === 'All' || u.room === this.selectedRoom)).sort((a, b) => (parseInt(a.no, 10) || 999) - (parseInt(b.no, 10) || 999));

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
        <div class="glass-card p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-xl">⏱️</span>
              เช็กชื่อรายคาบเรียน (Period Attendance Register)
            </h2>
            <p class="text-slate-500 text-xs mt-1">บันทึกเวลาเรียน 4 สถานะ (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴) พร้อมปุ่มเลือกยกห้อง</p>
          </div>

          <div class="flex items-center gap-3">
            <button id="btn-bulk-present" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-heading font-semibold">
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
            <label class="block text-xs font-semibold text-slate-600 mb-1">ระดับชั้น / ห้อง</label>
            <div class="flex gap-2">
              <select id="att-grade" class="input-field py-1.5 text-xs">
                <option value="ม.1" ${this.selectedGrade === 'ม.1' ? 'selected' : ''}>ม.1</option>
                <option value="ม.2" ${this.selectedGrade === 'ม.2' ? 'selected' : ''}>ม.2</option>
                <option value="ม.3" ${this.selectedGrade === 'ม.3' ? 'selected' : ''}>ม.3</option>
              </select>
              <select id="att-room" class="input-field py-1.5 text-xs">
                <option value="1" ${this.selectedRoom === '1' ? 'selected' : ''}>ห้อง 1</option>
                <option value="2" ${this.selectedRoom === '2' ? 'selected' : ''}>ห้อง 2</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">คาบเรียน</label>
            <select id="att-period" class="input-field py-1.5 text-xs">
              <option value="คาบที่ 1 (08:30 - 09:30)">คาบที่ 1 (08:30 - 09:30)</option>
              <option value="คาบที่ 2 (09:30 - 10:30)">คาบที่ 2 (09:30 - 10:30)</option>
              <option value="คาบที่ 3 (10:30 - 11:30)">คาบที่ 3 (10:30 - 11:30)</option>
              <option value="คาบที่ 4 (12:30 - 13:30)">คาบที่ 4 (12:30 - 13:30)</option>
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
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${students.length === 0 ? `
                  <tr><td colspan="5" class="text-center py-10 text-slate-400">ไม่พบรายชื่อนักเรียนในห้องนี้</td></tr>
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

    // Toggle Button Event Handlers
    containerEl.querySelectorAll('[data-student-status]').forEach(group => {
      const studentId = group.dataset.studentStatus;
      group.querySelectorAll('.att-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const status = e.currentTarget.dataset.status;
          recordsState[studentId] = status;

          // Re-render button highlights locally
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
        message: `บันทึกการเข้าเรียนวิชาดังกล่าวสำหรับ ${students.length} คนเรียบร้อยแล้ว`,
        type: 'success'
      });
    });
  }
}
