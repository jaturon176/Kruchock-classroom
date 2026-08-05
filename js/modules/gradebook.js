/**
 * Gradebook & Reports Module
 * Consolidates homework & quiz scores, renders comparison charts,
 * provides filter controls (Search Individual, Filter by Grade, Filter by Room),
 * and exports PDF/Excel reports.
 */

import { firebaseService } from '../services/firebaseService.js';
import { exportToCSV, printPDFReport } from '../services/exportService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';

export class GradebookModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedGrade = 'All';
    this.selectedRoom = 'All';
    this.searchQuery = '';
  }

  render(containerEl) {
    const users = firebaseService.getCollection('users');
    const homeworkList = firebaseService.getCollection('homework') || [];
    const quizzes = firebaseService.getCollection('quizzes') || [];
    const currentUser = this.rbac.getCurrentUser();

    // 🎓🔒 STUDENT RESTRICTION: Students can ONLY view their own scores!
    if (currentUser.role === 'Student') {
      this.renderStudentView(containerEl, currentUser, homeworkList, quizzes);
      return;
    }

    const allStudentUsers = users.filter(u => u.role === 'Student');

    // Available Grades
    const availableGrades = ['All', ...new Set(allStudentUsers.map(s => s.grade).filter(g => g && g !== '-'))];
    if (availableGrades.length === 1) availableGrades.push('ม.1', 'ม.2', 'ม.3', 'ปวช.1', 'ปวช.2');

    // Dynamic Available Rooms based on selected Grade
    let gradeFilteredUsers = allStudentUsers;
    if (this.selectedGrade !== 'All') {
      gradeFilteredUsers = allStudentUsers.filter(s => s.grade === this.selectedGrade);
    }
    const availableRooms = [...new Set(gradeFilteredUsers.map(s => s.room).filter(r => r && r !== '-'))].sort();

    // Apply Filters (1. Grade, 2. Room, 3. Individual Search Query)
    let filteredStudents = allStudentUsers;

    if (this.selectedGrade !== 'All') {
      filteredStudents = filteredStudents.filter(s => s.grade === this.selectedGrade);
    }

    if (this.selectedRoom !== 'All') {
      filteredStudents = filteredStudents.filter(s => s.room === this.selectedRoom);
    }

    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.trim().toLowerCase();
      filteredStudents = filteredStudents.filter(s => 
        (s.name && decodeMojibakeThai(s.name).toLowerCase().includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q))
      );
    }

    // Calculate consolidated scores per student
    const reportData = filteredStudents.map(s => {
      let totalHwPoints = 0;
      let earnedHwPoints = 0;

      homeworkList.forEach(hw => {
        totalHwPoints += (hw.maxPoints || 20);
        const sub = hw.submissions ? hw.submissions.find(subItem => subItem.studentId === s.studentId) : null;
        if (sub && sub.score !== null) {
          earnedHwPoints += sub.score;
        }
      });

      // Consolidate Quiz Scores from quizzes collection
      let totalQuizPoints = 0;
      let earnedQuizPoints = 0;

      quizzes.forEach(q => {
        const qMax = q.questions ? q.questions.reduce((sum, item) => sum + (parseInt(item.points, 10) || 1), 0) : 1;
        totalQuizPoints += qMax;

        if (q.results && Array.isArray(q.results)) {
          const myResult = q.results.find(r => r.studentId === s.studentId || r.studentName === s.name);
          if (myResult) {
            earnedQuizPoints += (myResult.score || 0);
          }
        }
      });

      const grandTotalEarned = earnedHwPoints + earnedQuizPoints;
      const grandTotalMax = totalHwPoints + totalQuizPoints;
      const percentage = grandTotalMax > 0 ? Math.round((grandTotalEarned / grandTotalMax) * 100) : 0;

      let gradeLetter = 'F';
      if (percentage >= 80) gradeLetter = '4 (A)';
      else if (percentage >= 70) gradeLetter = '3 (B)';
      else if (percentage >= 60) gradeLetter = '2 (C)';
      else if (percentage >= 50) gradeLetter = '1 (D)';

      return {
        studentId: s.studentId || s.username || '-',
        name: decodeMojibakeThai(s.name),
        grade: s.grade || '-',
        room: s.room || '-',
        earnedHwPoints,
        totalHwPoints,
        earnedQuizPoints,
        totalQuizPoints,
        grandTotalEarned,
        grandTotalMax,
        percentage,
        gradeLetter
      };
    });

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Header & Export Actions -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 text-xl">📊</span>
              สมุดเก็บคะแนนและรายงาน (Gradebook & Reports)
            </h2>
            <p class="text-slate-500 text-xs mt-1">รวบรวมคะแนนการบ้าน + แบบทดสอบ, คัดกรองรายบุคคล รายห้อง รายชั้น และส่งออกไฟล์ PDF/Excel</p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button id="btn-export-excel" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
              📊 ส่งออก Excel / CSV
            </button>
            <button id="btn-export-pdf" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-500/20">
              🖨️ พิมพ์ใบสรุปคะแนน PDF
            </button>
          </div>
        </div>

        <!-- Filter Controls Bar (คัดกรอง รายบุคคล / รายห้อง / รายชั้น) -->
        <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-lg">🔍</span>
              ตัวคัดกรองข้อมูลคะแนน (Score Filter Controls)
            </h3>
            <span class="text-xs text-slate-500 font-medium">พบทั้งหมด <strong class="text-indigo-600 font-bold">${reportData.length}</strong> รายชื่อ</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- 1. ค้นหารายบุคคล -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <span>👤</span> ค้นหารายบุคคล (ชื่อ / รหัสนักเรียน)
              </label>
              <input type="text" id="filter-search" value="${this.searchQuery}" class="input-field py-2 text-xs" placeholder="พิมพ์ชื่อ หรือ รหัสนักเรียนเพื่อค้นหา...">
            </div>

            <!-- 2. คัดกรองรายชั้น -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <span>🏫</span> เลือกรายชั้น (Grade)
              </label>
              <select id="filter-grade" class="input-field py-2 text-xs">
                <option value="All" ${this.selectedGrade === 'All' ? 'selected' : ''}>🌐 ทุกระดับชั้น (All Grades)</option>
                ${availableGrades.filter(g => g !== 'All').map(g => `
                  <option value="${g}" ${this.selectedGrade === g ? 'selected' : ''}>${g}</option>
                `).join('')}
              </select>
            </div>

            <!-- 3. คัดกรองรายห้อง -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <span>🚪</span> เลือกรายห้อง (Room)
              </label>
              <select id="filter-room" class="input-field py-2 text-xs">
                <option value="All" ${this.selectedRoom === 'All' ? 'selected' : ''}>🌐 ทุกห้องเรียน (All Rooms)</option>
                ${availableRooms.map(r => `
                  <option value="${r}" ${this.selectedRoom === r ? 'selected' : ''}>ห้อง ${r}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Visual Analytics Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <!-- Grade Distribution Box -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-4">
            <h3 class="font-bold text-slate-900 text-sm font-heading flex items-center gap-2">
              <span>📈</span> การกระจายตัวของเกรด
            </h3>
            <div class="space-y-3 pt-1">
              ${['4 (A)', '3 (B)', '2 (C)', '1 (D)', 'F'].map(g => {
                const count = reportData.filter(r => r.gradeLetter === g).length;
                const pct = reportData.length > 0 ? Math.round((count / reportData.length) * 100) : 0;
                return `
                  <div>
                    <div class="flex justify-between text-xs font-semibold text-slate-600">
                      <span>เกรด ${g}</span>
                      <span>${count} คน (${pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1 border border-slate-200">
                      <div class="bg-indigo-600 h-full transition-all" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Score Breakdown Card -->
          <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 md:col-span-2 space-y-4">
            <h3 class="font-bold text-slate-900 text-sm font-heading flex items-center gap-2">
              <span>📊</span> เปรียบเทียบคะแนนเฉลี่ยการบ้านเทียบกับแบบทดสอบ
            </h3>
            <div class="grid grid-cols-2 gap-4 py-2">
              <div class="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center">
                <div class="text-xs text-indigo-700 font-bold font-heading uppercase tracking-wider">คะแนนการบ้านเฉลี่ย</div>
                <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">
                  ${reportData.length > 0 ? Math.round(reportData.reduce((a, b) => a + b.earnedHwPoints, 0) / reportData.length) : 0} <span class="text-xs font-normal text-slate-500">คะแนน</span>
                </div>
              </div>

              <div class="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
                <div class="text-xs text-emerald-700 font-bold font-heading uppercase tracking-wider">คะแนนแบบทดสอบเฉลี่ย</div>
                <div class="text-3xl font-extrabold text-slate-900 font-heading mt-1">
                  ${reportData.length > 0 ? Math.round(reportData.reduce((a, b) => a + b.earnedQuizPoints, 0) / reportData.length) : 0} <span class="text-xs font-normal text-slate-500">คะแนน</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gradebook Consolidated Matrix Table -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-4 whitespace-nowrap">รหัสนักเรียน</th>
                  <th class="p-4 whitespace-nowrap">ชื่อ-นามสกุล</th>
                  <th class="p-4 text-center whitespace-nowrap">ระดับชั้น/ห้อง</th>
                  <th class="p-4 text-center whitespace-nowrap">คะแนนการบ้าน</th>
                  <th class="p-4 text-center whitespace-nowrap">คะแนนแบบทดสอบ</th>
                  <th class="p-4 text-center whitespace-nowrap">คะแนนรวม</th>
                  <th class="p-4 text-center whitespace-nowrap">คิดเป็น %</th>
                  <th class="p-4 text-center whitespace-nowrap">ระดับเกรด</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
                ${reportData.length === 0 ? `
                  <tr><td colspan="8" class="text-center py-10 text-slate-400">ไม่พบข้อมูลคะแนนตามเงื่อนไขการค้นหาที่เลือก</td></tr>
                ` : reportData.map(r => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-4 font-mono font-bold text-indigo-600 whitespace-nowrap">${r.studentId}</td>
                    <td class="p-4 font-bold text-slate-900 whitespace-nowrap">${r.name}</td>
                    <td class="p-4 text-center whitespace-nowrap">
                      <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-xl font-semibold text-xs whitespace-nowrap inline-block">${r.grade}/${r.room}</span>
                    </td>
                    <td class="p-4 text-center text-slate-600 font-mono whitespace-nowrap">${r.earnedHwPoints} / ${r.totalHwPoints}</td>
                    <td class="p-4 text-center text-slate-600 font-mono whitespace-nowrap">${r.earnedQuizPoints} / ${r.totalQuizPoints}</td>
                    <td class="p-4 text-center font-bold text-indigo-600 font-mono whitespace-nowrap">${r.grandTotalEarned} / ${r.grandTotalMax}</td>
                    <td class="p-4 text-center font-bold font-mono text-slate-900 whitespace-nowrap">${r.percentage}%</td>
                    <td class="p-4 text-center whitespace-nowrap">
                      <span class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-block ${
                        r.gradeLetter.startsWith('4') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        r.gradeLetter.startsWith('3') ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                        r.gradeLetter.startsWith('2') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        r.gradeLetter.startsWith('1') ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }">
                        ${r.gradeLetter}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Filter Controls Handlers (Individual Search, Grade Filter, Room Filter)
    const searchInput = containerEl.querySelector('#filter-search');
    const gradeSelect = containerEl.querySelector('#filter-grade');
    const roomSelect = containerEl.querySelector('#filter-room');

    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render(containerEl);

      // Restore focus to input after re-render
      const newSearch = containerEl.querySelector('#filter-search');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
      }
    });

    gradeSelect?.addEventListener('change', (e) => {
      this.selectedGrade = e.target.value;
      this.selectedRoom = 'All'; // Reset room when grade changes
      this.render(containerEl);
    });

    roomSelect?.addEventListener('change', (e) => {
      this.selectedRoom = e.target.value;
      this.render(containerEl);
    });

    // Action Handlers for Export
    containerEl.querySelector('#btn-export-excel')?.addEventListener('click', () => {
      const exportRows = reportData.map(r => ({
        'รหัสนักเรียน': r.studentId,
        'ชื่อ-นามสกุล': r.name,
        'ระดับชั้น': r.grade,
        'ห้อง': r.room,
        'คะแนนการบ้าน': `${r.earnedHwPoints}/${r.totalHwPoints}`,
        'คะแนนแบบทดสอบ': `${r.earnedQuizPoints}/${r.totalQuizPoints}`,
        'คะแนนรวม': r.grandTotalEarned,
        'คะแนนเต็ม': r.grandTotalMax,
        'ร้อยละ (%)': `${r.percentage}%`,
        'เกรด': r.gradeLetter
      }));
      exportToCSV(`Gradebook_${this.selectedGrade}_Room${this.selectedRoom}.csv`, exportRows);
    });

    containerEl.querySelector('#btn-export-pdf')?.addEventListener('click', () => {
      const headers = ['รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชั้น/ห้อง', 'คะแนนการบ้าน', 'คะแนนแบบทดสอบ', 'คะแนนรวม', '%', 'เกรด'];
      const dataRows = reportData.map(r => [
        r.studentId,
        r.name,
        `${r.grade}/${r.room}`,
        `${r.earnedHwPoints}/${r.totalHwPoints}`,
        `${r.earnedQuizPoints}/${r.totalQuizPoints}`,
        `${r.grandTotalEarned}/${r.grandTotalMax}`,
        `${r.percentage}%`,
        r.gradeLetter
      ]);

      printPDFReport(
        `ใบสรุปรายงานผลคะแนนนักเรียน (${this.selectedGrade === 'All' ? 'ทุกระดับชั้น' : this.selectedGrade} ${this.selectedRoom === 'All' ? 'ทุกห้อง' : 'ห้อง ' + this.selectedRoom})`,
        `ประจำปีการศึกษา 2026 - รวมคะแนนการบ้านและแบบทดสอบออนไลน์`,
        headers,
        dataRows
      );
    });
  }

  // 🎓 Personal Gradebook View for Logged-In Student
  renderStudentView(containerEl, currentUser, homeworkList, quizzes) {
    const stdId = currentUser.studentId || currentUser.username || '';
    const stdName = decodeMojibakeThai(currentUser.name);

    // 1. Calculate Homework Scores for logged in student
    let totalHwPoints = 0;
    let earnedHwPoints = 0;
    const hwDetails = homeworkList.map(hw => {
      const maxP = hw.maxPoints || 20;
      totalHwPoints += maxP;
      const sub = hw.submissions ? hw.submissions.find(s => 
        (s.studentId && stdId && s.studentId.toLowerCase() === stdId.toLowerCase()) ||
        (s.studentName && s.studentName.toLowerCase() === stdName.toLowerCase())
      ) : null;

      let scoreVal = 0;
      let statusText = 'ยังไม่ส่ง';
      let statusClass = 'bg-rose-50 text-rose-700 border-rose-200';

      if (sub) {
        if (sub.score !== null && sub.score !== undefined) {
          scoreVal = sub.score;
          earnedHwPoints += scoreVal;
          statusText = `ตรวจแล้ว (${scoreVal}/${maxP})`;
          statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else {
          statusText = 'ส่งแล้ว (รอตรวจ)';
          statusClass = 'bg-amber-50 text-amber-700 border-amber-200';
        }
      }

      return {
        title: decodeMojibakeThai(hw.title),
        subject: decodeMojibakeThai(hw.subject || 'ทั่วไป'),
        dueDate: hw.dueDate || '-',
        maxPoints: maxP,
        score: scoreVal,
        submitted: !!sub,
        statusText,
        statusClass
      };
    });

    // 2. Calculate Quiz Scores for logged in student
    let totalQuizPoints = 0;
    let earnedQuizPoints = 0;
    const quizDetails = quizzes.map(q => {
      const qMax = q.questions ? q.questions.reduce((sum, item) => sum + (parseInt(item.points, 10) || 1), 0) : 1;
      totalQuizPoints += qMax;

      const myResult = (q.results && Array.isArray(q.results)) ? q.results.find(r => 
        (r.studentId && stdId && r.studentId.toLowerCase() === stdId.toLowerCase()) ||
        (r.studentName && r.studentName.toLowerCase() === stdName.toLowerCase())
      ) : null;

      let scoreVal = 0;
      let statusText = 'ยังไม่ได้ทำ';
      let statusClass = 'bg-slate-100 text-slate-600 border-slate-200';

      if (myResult) {
        scoreVal = myResult.score || 0;
        earnedQuizPoints += scoreVal;
        statusText = `ทำแล้ว (${scoreVal}/${qMax})`;
        statusClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      }

      return {
        title: decodeMojibakeThai(q.title),
        subject: decodeMojibakeThai(q.subject || 'ทั่วไป'),
        maxPoints: qMax,
        score: scoreVal,
        completed: !!myResult,
        statusText,
        statusClass
      };
    });

    // 3. Consolidated totals
    const grandTotalEarned = earnedHwPoints + earnedQuizPoints;
    const grandTotalMax = totalHwPoints + totalQuizPoints;
    const percentage = grandTotalMax > 0 ? Math.round((grandTotalEarned / grandTotalMax) * 100) : 0;

    let gradeLetter = 'F';
    if (percentage >= 80) gradeLetter = '4 (A)';
    else if (percentage >= 70) gradeLetter = '3 (B)';
    else if (percentage >= 60) gradeLetter = '2 (C)';
    else if (percentage >= 50) gradeLetter = '1 (D)';

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Student Header Card -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-600 p-1 shadow-md shadow-sky-500/20 shrink-0">
              <div class="w-full h-full rounded-xl bg-white flex items-center justify-center overflow-hidden text-2xl">
                ${currentUser.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:image')) ? `<img src="${currentUser.avatar}" class="w-full h-full object-cover">` : (currentUser.avatar || '🎓')}
              </div>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-2xl font-bold text-slate-900 font-heading">
                  ${stdName}
                </h2>
                <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">${stdId}</span>
              </div>
              <p class="text-slate-500 text-xs mt-1">รายงานผลคะแนนและการเรียนส่วนบุคคล (${currentUser.grade || '-'} / ห้อง ${currentUser.room || '-'})</p>
            </div>
          </div>

          <div>
            <button id="btn-export-student-pdf" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-500/20 flex items-center gap-1.5">
              <span>🖨️</span> พิมพ์ใบบันทึกผลการเรียน (PDF)
            </button>
          </div>
        </div>

        <!-- Student KPI Score Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <!-- Homework Card -->
          <div class="glass-card p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div class="text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">คะแนนการบ้านของฉัน</div>
              <div class="text-2xl font-extrabold text-indigo-600 font-heading mt-1">
                ${earnedHwPoints} <span class="text-xs font-normal text-slate-400">/ ${totalHwPoints} คะแนน</span>
              </div>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-xl font-bold">
              📚
            </div>
          </div>

          <!-- Quiz Card -->
          <div class="glass-card p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div class="text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">คะแนนแบบทดสอบของฉัน</div>
              <div class="text-2xl font-extrabold text-emerald-600 font-heading mt-1">
                ${earnedQuizPoints} <span class="text-xs font-normal text-slate-400">/ ${totalQuizPoints} คะแนน</span>
              </div>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-xl font-bold">
              ✨
            </div>
          </div>

          <!-- Total Grade Card -->
          <div class="glass-card p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div class="text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">คะแนนรวมสะสม / เกรด</div>
              <div class="text-2xl font-extrabold text-slate-900 font-heading mt-1">
                ${percentage}% <span class="text-xs font-bold px-2 py-0.5 rounded-full ${
                  gradeLetter.startsWith('4') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  gradeLetter.startsWith('3') ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                  gradeLetter.startsWith('2') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  gradeLetter.startsWith('1') ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                  'bg-rose-50 text-rose-700 border border-rose-200'
                }">เกรด ${gradeLetter}</span>
              </div>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-xl font-bold">
              🏆
            </div>
          </div>
        </div>

        <!-- Section 1: Homework Scores Detail Table -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200 space-y-4 p-6">
          <h3 class="font-bold text-slate-900 text-base font-heading flex items-center gap-2">
            <span>📚</span> รายละเอียดคะแนนการบ้าน
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-3.5 whitespace-nowrap">วิชา / หัวข้อการบ้าน</th>
                  <th class="p-3.5 text-center whitespace-nowrap">กำหนดส่ง</th>
                  <th class="p-3.5 text-center whitespace-nowrap">คะแนนเต็ม</th>
                  <th class="p-3.5 text-center whitespace-nowrap">คะแนนที่ได้</th>
                  <th class="p-3.5 text-center whitespace-nowrap">สถานะ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
                ${hwDetails.length === 0 ? `
                  <tr><td colspan="5" class="text-center py-6 text-slate-400">ยังไม่มีรายการการบ้านในระบบ</td></tr>
                ` : hwDetails.map(h => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3.5 font-bold text-slate-900">
                      <div>${h.title}</div>
                      <div class="text-[11px] text-slate-400 font-normal">${h.subject}</div>
                    </td>
                    <td class="p-3.5 text-center text-slate-500 text-xs whitespace-nowrap">${h.dueDate}</td>
                    <td class="p-3.5 text-center font-mono text-slate-600 whitespace-nowrap">${h.maxPoints}</td>
                    <td class="p-3.5 text-center font-mono font-bold text-indigo-600 whitespace-nowrap">${h.score}</td>
                    <td class="p-3.5 text-center whitespace-nowrap">
                      <span class="px-2.5 py-1 rounded-xl text-xs font-bold border ${h.statusClass}">${h.statusText}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 2: Quiz Scores Detail Table -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200 space-y-4 p-6">
          <h3 class="font-bold text-slate-900 text-base font-heading flex items-center gap-2">
            <span>✨</span> รายละเอียดคะแนนแบบทดสอบ
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-3.5 whitespace-nowrap">หัวข้อแบบทดสอบ</th>
                  <th class="p-3.5 text-center whitespace-nowrap">วิชา</th>
                  <th class="p-3.5 text-center whitespace-nowrap">คะแนนเต็ม</th>
                  <th class="p-3.5 text-center whitespace-nowrap">คะแนนที่ได้</th>
                  <th class="p-3.5 text-center whitespace-nowrap">สถานะ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
                ${quizDetails.length === 0 ? `
                  <tr><td colspan="5" class="text-center py-6 text-slate-400">ยังไม่มีรายการแบบทดสอบในระบบ</td></tr>
                ` : quizDetails.map(q => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3.5 font-bold text-slate-900">${q.title}</td>
                    <td class="p-3.5 text-center text-slate-500 text-xs whitespace-nowrap">${q.subject}</td>
                    <td class="p-3.5 text-center font-mono text-slate-600 whitespace-nowrap">${q.maxPoints}</td>
                    <td class="p-3.5 text-center font-mono font-bold text-emerald-600 whitespace-nowrap">${q.score}</td>
                    <td class="p-3.5 text-center whitespace-nowrap">
                      <span class="px-2.5 py-1 rounded-xl text-xs font-bold border ${q.statusClass}">${q.statusText}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // PDF Print Handler for Student
    containerEl.querySelector('#btn-export-student-pdf')?.addEventListener('click', () => {
      const headers = ['ประเภท', 'วิชา / หัวข้อ', 'คะแนนเต็ม', 'คะแนนที่ได้', 'สถานะ'];
      const dataRows = [
        ...hwDetails.map(h => ['การบ้าน', `${h.subject} - ${h.title}`, String(h.maxPoints), String(h.score), h.statusText]),
        ...quizDetails.map(q => ['แบบทดสอบ', `${q.subject} - ${q.title}`, String(q.maxPoints), String(q.score), q.statusText]),
        ['สรุปผลรวม', 'รวมคะแนนทั้งหมดทุกวิชา', String(grandTotalMax), `${grandTotalEarned} (${percentage}%)`, `เกรด ${gradeLetter}`]
      ];

      printPDFReport(
        `ใบรายงานผลการเรียนส่วนบุคคล (${stdName})`,
        `รหัสนักเรียน: ${stdId} | ชั้น/ห้อง: ${currentUser.grade || '-'}/${currentUser.room || '-'} | คะแนนรวม: ${percentage}% (เกรด ${gradeLetter})`,
        headers,
        dataRows
      );
    });
  }
}
