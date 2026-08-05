/**
 * Students Module
 * Ultra-modern Students Directory with:
 * - Live Search Bar & Filter by Grade/Room
 * - View Mode Switcher (Table View vs Glass Card Grid View)
 * - Intelligent Summary Stat Cards (Total Students, Active Classes, Distribution)
 * - 10-Item Pagination (หน้า 1, 2, 3, 4...)
 * - Student Quick Profile Modal
 * - Direct CSV File Upload (.csv) & Drag & Drop with Mojibake repair
 * - Export Roster & Batch Deletion
 */

import { firebaseService } from '../services/firebaseService.js?v=3.1';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js?v=3.1';
import { showConfirmModal, showAlertModal } from '../services/dialogService.js?v=3.1';

export class StudentsModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedGrade = 'All';
    this.selectedRoom = 'All';
    this.searchQuery = '';
    this.viewMode = 'table'; // 'table' or 'grid'
    this.currentPage = 1;
    this.pageSize = 10;
  }

  render(containerEl) {
    const users = firebaseService.getCollection('users');
    const students = users.filter(u => u.role === 'Student');

    // Extract unique grades and rooms
    const grades = ['All', ...new Set(students.map(s => s.grade).filter(g => g && g !== '-'))];
    const rooms = ['All', ...new Set(students.map(s => s.room).filter(r => r && r !== '-'))];

    // Filter students by grade, room, and live search query
    const filtered = students.filter(s => {
      if (this.selectedGrade !== 'All' && s.grade !== this.selectedGrade) return false;
      if (this.selectedRoom !== 'All' && s.room !== this.selectedRoom) return false;
      
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const stdName = decodeMojibakeThai(s.name).toLowerCase();
        const stdId = (s.studentId || '').toLowerCase();
        if (!stdName.includes(query) && !stdId.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => {
      const noA = parseInt(a.no, 10) || 999;
      const noB = parseInt(b.no, 10) || 999;
      return noA - noB;
    });

    // Dynamic page size based on view mode (9 for grid card view, 10 for table view)
    const effectivePageSize = this.viewMode === 'grid' ? 9 : 10;

    // Pagination calculations
    const totalStudents = filtered.length;
    const totalPages = Math.ceil(totalStudents / effectivePageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIdx = (this.currentPage - 1) * effectivePageSize;
    const endIdx = startIdx + effectivePageSize;
    const paginatedStudents = filtered.slice(startIdx, endIdx);

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Header & Action Controls -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-3">
              <span class="p-2.5 bg-gradient-to-tr from-sky-500 to-indigo-600 text-white rounded-2xl shadow-md shadow-sky-500/20 text-xl">👨‍🎓</span>
              ระบบจัดการรายชื่อนักเรียน (Students Directory)
            </h2>
            <p class="text-slate-500 text-xs mt-1">ค้นหารายชื่อสด, คัดกรองแยกชั้น/ห้อง, สลับมุมมองตาราง/การ์ด, นำเข้า CSV และพิมพ์รายชื่อ</p>
          </div>

          ${this.rbac.canManageUsers() ? `
            <div class="flex flex-wrap items-center gap-2.5">
              <button id="btn-export-csv" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-heading font-semibold flex items-center gap-1.5">
                <span>📥</span> ส่งออก CSV
              </button>
              <button id="btn-import-csv" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-heading font-semibold flex items-center gap-1.5">
                <span>📁</span> นำเข้า CSV
              </button>
              <button id="btn-batch-delete" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs px-3.5 py-2 rounded-xl font-heading font-semibold flex items-center gap-1.5 transition-colors">
                <span>🗑️</span> ลบยกกลุ่ม
              </button>
              <button id="btn-add-student" class="btn-primary text-xs px-4 py-2 rounded-xl font-heading font-semibold flex items-center gap-1.5 shadow-md shadow-sky-500/20">
                <span>➕</span> เพิ่มนักเรียน
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Intelligent KPI Stat Summary Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div class="glass-card p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div class="text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">นักเรียนในระบบทั้งหมด</div>
              <div class="text-2xl font-extrabold text-slate-900 font-heading mt-1">${students.length} <span class="text-xs font-normal text-slate-500">คน</span></div>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center text-xl font-bold">
              👨‍🎓
            </div>
          </div>

          <div class="glass-card p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div class="text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">ผลคัดกรองตามเงื่อนไข</div>
              <div class="text-2xl font-extrabold text-indigo-600 font-heading mt-1">${totalStudents} <span class="text-xs font-normal text-slate-500">คน</span></div>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-xl font-bold">
              🎯
            </div>
          </div>

          <div class="glass-card p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div class="text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">ห้องเรียนที่เปิดสอน</div>
              <div class="text-2xl font-extrabold text-emerald-600 font-heading mt-1">${rooms.length - 1 || 1} <span class="text-xs font-normal text-slate-500">ห้อง</span></div>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-xl font-bold">
              🏫
            </div>
          </div>
        </div>

        <!-- Toolbar: Live Search + Filters + View Mode Switcher -->
        <div class="glass-card p-4 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <!-- Search Bar -->
          <div class="relative w-full md:w-80">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input 
              type="text" 
              id="search-student-input" 
              value="${this.searchQuery}" 
              placeholder="ค้นหาชื่อ-นามสกุล หรือรหัสนักเรียน..." 
              class="input-field pl-10 py-2 text-xs border-slate-200 bg-slate-50/70 focus:bg-white"
            >
          </div>

          <!-- Grade & Room Filters -->
          <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div class="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span>🏷️ ชั้น:</span>
              <select id="filter-grade" class="input-field py-1.5 px-3 w-auto text-xs">
                ${grades.map(g => `<option value="${g}" ${this.selectedGrade === g ? 'selected' : ''}>${g === 'All' ? 'ทุกระดับชั้น' : g}</option>`).join('')}
              </select>
            </div>

            <div class="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span>🚪 ห้อง:</span>
              <select id="filter-room" class="input-field py-1.5 px-3 w-auto text-xs">
                ${rooms.map(r => `<option value="${r}" ${this.selectedRoom === r ? 'selected' : ''}>${r === 'All' ? 'ทุกห้อง' : `ห้อง ${r}`}</option>`).join('')}
              </select>
            </div>

            <!-- View Mode Switcher Buttons -->
            <div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 ml-auto">
              <button id="view-table-btn" class="px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${this.viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}">
                📄 ตาราง
              </button>
              <button id="view-grid-btn" class="px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${this.viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}">
                🎴 การ์ด
              </button>
            </div>
          </div>
        </div>

        <!-- Roster Content Area (Table View OR Glass Card Grid View) -->
        ${this.viewMode === 'table' ? `
          <!-- Table View -->
          <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                    <th class="p-4">รหัสนักเรียน</th>
                    <th class="p-4 text-center">เลขที่</th>
                    <th class="p-4">ชื่อ-นามสกุล</th>
                    <th class="p-4 text-center">ชั้น</th>
                    <th class="p-4 text-center">ห้อง</th>
                    ${this.rbac.canManageUsers() ? '<th class="p-4 text-right">จัดการ</th>' : ''}
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  ${paginatedStudents.length === 0 ? `
                    <tr><td colspan="6" class="text-center py-12 text-slate-400 font-medium">ไม่พบรายชื่อนักเรียนตามเงื่อนไขที่เลือก</td></tr>
                  ` : paginatedStudents.map(s => `
                    <tr class="hover:bg-sky-50/50 transition-colors group cursor-pointer" data-view-std="${s.id}">
                      <td class="p-4 font-mono text-indigo-600 font-bold">${s.studentId}</td>
                      <td class="p-4 text-center">
                        <span class="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-700 inline-flex items-center justify-center font-bold text-xs text-slate-700 transition-colors">
                          ${s.no || '-'}
                        </span>
                      </td>
                      <td class="p-4 font-medium text-slate-900 flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 p-0.5 shadow-sm shrink-0">
                          <div class="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden text-sm">
                            ${s.avatar && (s.avatar.startsWith('http') || s.avatar.startsWith('data:image')) ? `<img src="${s.avatar}" class="w-full h-full object-cover">` : (s.avatar || '🎓')}
                          </div>
                        </div>
                        <div>
                          <div class="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">${decodeMojibakeThai(s.name)}</div>
                          <div class="text-[11px] text-slate-400 font-mono">Username: ${s.studentId}</div>
                        </div>
                      </td>
                      <td class="p-4 text-center">
                        <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-3 py-1 rounded-xl font-bold font-heading">
                          ${s.grade}
                        </span>
                      </td>
                      <td class="p-4 text-center">
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-3 py-1 rounded-xl font-bold font-heading">
                          ห้อง ${s.room}
                        </span>
                      </td>
                      ${this.rbac.canManageUsers() ? `
                        <td class="p-4 text-right space-x-2">
                          <button data-edit-std="${s.id}" class="text-indigo-600 hover:text-indigo-800 font-bold px-2.5 py-1 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all text-xs">✏️ แก้ไข</button>
                          <button data-del-std="${s.id}" data-std-name="${decodeMojibakeThai(s.name)}" class="text-rose-600 hover:text-rose-800 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all text-xs">🗑️ ลบ</button>
                        </td>
                      ` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Pagination Bar -->
            <div class="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <div class="text-slate-500 font-medium">
                แสดง <strong class="text-slate-900 font-bold">${totalStudents > 0 ? startIdx + 1 : 0} - ${Math.min(endIdx, totalStudents)}</strong> จากทั้งหมด <strong class="text-slate-900 font-bold">${totalStudents}</strong> รายชื่อ
              </div>

              <div class="flex items-center gap-1.5 font-heading">
                <button id="std-pg-prev" ${this.currentPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                  ◀️ ก่อนหน้า
                </button>

                <div class="flex items-center gap-1">
                  ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                    <button data-std-page-btn="${p}" class="w-8 h-8 rounded-xl font-bold transition-all ${
                      p === this.currentPage ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }">
                      ${p}
                    </button>
                  `).join('')}
                </div>

                <button id="std-pg-next" ${this.currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                  ถัดไป ▶️
                </button>
              </div>
            </div>
          </div>
        ` : `
          <!-- Glass Card Grid View -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            ${paginatedStudents.length === 0 ? `
              <div class="col-span-full glass-card p-12 text-center text-slate-400 rounded-3xl bg-white border border-slate-200">ไม่พบรายชื่อนักเรียน</div>
            ` : paginatedStudents.map(s => `
              <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 hover:border-indigo-300 transition-all hover:-translate-y-1 space-y-4 flex flex-col justify-between relative group">
                <div>
                  <div class="flex justify-between items-start gap-2">
                    <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-2.5 py-1 rounded-xl font-bold font-mono">
                      ${s.studentId}
                    </span>
                    <span class="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-xl font-bold font-heading">
                      เลขที่ ${s.no || '-'}
                    </span>
                  </div>

                  <div class="text-center pt-3 space-y-2">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-600 p-1 shadow-md shadow-sky-500/20 mx-auto">
                      <div class="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden text-2xl">
                        ${s.avatar && (s.avatar.startsWith('http') || s.avatar.startsWith('data:image')) ? `<img src="${s.avatar}" class="w-full h-full object-cover">` : (s.avatar || '🎓')}
                      </div>
                    </div>

                    <h3 class="text-lg font-bold text-slate-900 font-heading leading-snug group-hover:text-indigo-600 transition-colors">
                      ${decodeMojibakeThai(s.name)}
                    </h3>

                    <div class="flex items-center justify-center gap-2 text-xs">
                      <span class="bg-purple-50 text-purple-700 border border-purple-100 px-3 py-0.5 rounded-full font-semibold">${s.grade}</span>
                      <span class="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-0.5 rounded-full font-semibold">ห้อง ${s.room}</span>
                    </div>
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <button data-view-std="${s.id}" class="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1">
                    🔍 ดูโปรไฟล์
                  </button>

                  ${this.rbac.canManageUsers() ? `
                    <div class="flex items-center gap-2">
                      <button data-edit-std="${s.id}" class="text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1">✏️ แก้ไข</button>
                      <button data-del-std="${s.id}" data-std-name="${decodeMojibakeThai(s.name)}" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-1">🗑️ ลบ</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Pagination Bar for Grid View -->
          <div class="glass-card p-4 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <div class="text-slate-500 font-medium">
              แสดง <strong class="text-slate-900 font-bold">${totalStudents > 0 ? startIdx + 1 : 0} - ${Math.min(endIdx, totalStudents)}</strong> จากทั้งหมด <strong class="text-slate-900 font-bold">${totalStudents}</strong> รายชื่อ
            </div>

            <div class="flex items-center gap-1.5 font-heading">
              <button id="std-pg-prev-grid" ${this.currentPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                ◀️ ก่อนหน้า
              </button>

              <div class="flex items-center gap-1">
                ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                  <button data-std-page-btn="${p}" class="w-8 h-8 rounded-xl font-bold transition-all ${
                    p === this.currentPage ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }">
                    ${p}
                  </button>
                `).join('')}
              </div>

              <button id="std-pg-next-grid" ${this.currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                ถัดไป ▶️
              </button>
            </div>
          </div>
        `}
      </div>
    `;

    // Live Search Input Event
    const searchInput = containerEl.querySelector('#search-student-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.currentPage = 1;
        this.render(containerEl);
        // Restore focus to search input
        const newSearchInput = containerEl.querySelector('#search-student-input');
        if (newSearchInput) {
          newSearchInput.focus();
          newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
        }
      });
    }

    // Filter Change Event Handlers
    containerEl.querySelector('#filter-grade')?.addEventListener('change', (e) => {
      this.selectedGrade = e.target.value;
      this.currentPage = 1;
      this.render(containerEl);
    });

    containerEl.querySelector('#filter-room')?.addEventListener('change', (e) => {
      this.selectedRoom = e.target.value;
      this.currentPage = 1;
      this.render(containerEl);
    });

    // View Mode Handlers
    containerEl.querySelector('#view-table-btn')?.addEventListener('click', () => {
      this.viewMode = 'table';
      this.render(containerEl);
    });

    containerEl.querySelector('#view-grid-btn')?.addEventListener('click', () => {
      this.viewMode = 'grid';
      this.render(containerEl);
    });

    // Pagination Event Handlers
    const bindPaginationEvents = () => {
      containerEl.querySelectorAll('#std-pg-prev, #std-pg-prev-grid').forEach(b => b.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render(containerEl);
        }
      }));

      containerEl.querySelectorAll('#std-pg-next, #std-pg-next-grid').forEach(b => b.addEventListener('click', () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render(containerEl);
        }
      }));

      containerEl.querySelectorAll('[data-std-page-btn]').forEach(b => {
        b.addEventListener('click', (e) => {
          this.currentPage = parseInt(e.currentTarget.dataset.stdPageBtn, 10);
          this.render(containerEl);
        });
      });
    };

    bindPaginationEvents();

    // Export CSV Handler
    containerEl.querySelector('#btn-export-csv')?.addEventListener('click', () => this.exportToCSV(filtered));

    // Action Handlers
    containerEl.querySelector('#btn-import-csv')?.addEventListener('click', () => this.showCsvModal(() => this.render(containerEl)));
    containerEl.querySelector('#btn-batch-delete')?.addEventListener('click', () => this.showBatchDeleteModal(() => this.render(containerEl)));
    containerEl.querySelector('#btn-add-student')?.addEventListener('click', () => this.showStudentModal(null, () => this.render(containerEl)));

    // View Student Profile Drawer/Modal
    containerEl.querySelectorAll('[data-view-std]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit-std]') || e.target.closest('[data-del-std]')) return;
        const id = e.currentTarget.dataset.viewStd;
        const std = users.find(u => u.id === id);
        this.showStudentProfileModal(std);
      });
    });

    containerEl.querySelectorAll('[data-edit-std]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.editStd;
        const std = users.find(u => u.id === id);
        this.showStudentModal(std, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-del-std]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.delStd;
        const stdName = e.currentTarget.dataset.stdName;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบนักเรียน',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายชื่อ "${stdName}" ออกจากระบบ? ข้อมูลการเรียนประวัติเดิมจะถูกนำออก`,
          confirmText: 'ยืนยันลบรายชื่อ',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('users', id);
          this.render(containerEl);
        }
      });
    });
  }

  // Export Roster to CSV File Download
  exportToCSV(studentsList) {
    let csvContent = 'data:text/csv;charset=utf-8,รหัสนักเรียน,เลขที่,ชื่อ-สกุล,ชั้น,ห้อง\n';
    studentsList.forEach(s => {
      csvContent += `${s.studentId},${s.no || ''},${decodeMojibakeThai(s.name)},${s.grade},${s.room}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Roster_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // View Student Profile Drawer Modal
  showStudentProfileModal(student) {
    if (!student) return;

    const modalHTML = `
      <div id="std-profile-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white text-center space-y-5">
          <button id="close-profile-modal" class="absolute right-5 top-5 text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>

          <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 p-1 shadow-lg shadow-sky-500/20 mx-auto">
            <div class="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden text-3xl">
              ${student.avatar && (student.avatar.startsWith('http') || student.avatar.startsWith('data:image')) ? `<img src="${student.avatar}" class="w-full h-full object-cover">` : (student.avatar || '🎓')}
            </div>
          </div>

          <div>
            <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-3 py-1 rounded-full font-bold font-mono">
              ${student.studentId}
            </span>
            <h3 class="text-xl font-bold font-heading text-slate-900 mt-2">${decodeMojibakeThai(student.name)}</h3>
            <p class="text-xs text-slate-500 font-heading">นักเรียน ${student.grade} ห้อง ${student.room} (เลขที่ ${student.no || '-'})</p>
          </div>

          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 text-left font-mono">
            <div class="flex justify-between">
              <span class="text-slate-500 font-heading">ชื่อผู้ใช้ (Username):</span>
              <strong class="text-indigo-600">${student.studentId}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-heading">รหัสผ่านเริ่มต้น:</span>
              <strong class="text-slate-800">${student.studentId}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-heading">สถานะการเรียน:</span>
              <strong class="text-emerald-600">🟢 ปกติ (Active)</strong>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button id="close-profile-btn" class="btn-primary w-full py-2.5 rounded-xl text-xs font-bold font-heading">ปิดหน้าต่าง</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('std-profile-modal');

    modalEl.querySelectorAll('#close-profile-modal, #close-profile-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));
  }

  showStudentModal(std, refreshCb) {
    const isEdit = !!std;
    const modalHTML = `
      <div id="std-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">
              ${isEdit ? '✏️ แก้ไขข้อมูลนักเรียน' : '➕ เพิ่มรายชื่อนักเรียน'}
            </h3>
            <button id="close-std-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="std-form" class="space-y-4 mt-4">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="block text-xs font-semibold text-slate-600 mb-1">รหัสนักเรียน</label>
                <input type="text" id="std-code" value="${isEdit ? std.studentId : ''}" required class="input-field" placeholder="STD6709">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">เลขที่</label>
                <input type="number" id="std-no" value="${isEdit ? (std.no || '') : ''}" required class="input-field" placeholder="1">
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ชื่อ-นามสกุล</label>
              <input type="text" id="std-name" value="${isEdit ? std.name : ''}" required class="input-field" placeholder="ด.ช. สมเกียรติ มั่นคง">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">ระดับชั้น</label>
                <input type="text" id="std-grade" value="${isEdit ? std.grade : 'ม.1'}" required class="input-field" placeholder="ม.1">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">ห้องเรียน</label>
                <input type="text" id="std-room" value="${isEdit ? std.room : '1'}" required class="input-field" placeholder="1">
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-std-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2 rounded-xl text-sm font-medium font-heading">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('std-modal');

    modalEl.querySelectorAll('#close-std-modal, #close-std-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#std-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const stdCode = document.getElementById('std-code').value.trim();
      const payload = {
        studentId: stdCode,
        no: document.getElementById('std-no').value.trim() || '1',
        name: document.getElementById('std-name').value.trim(),
        grade: document.getElementById('std-grade').value.trim(),
        room: document.getElementById('std-room').value.trim(),
        email: `${stdCode.toLowerCase()}@student.ac.th`,
        role: 'Student'
      };

      if (isEdit) {
        firebaseService.updateItem('users', std.id, payload);
      } else {
        firebaseService.addItem('users', payload);
      }

      modalEl.remove();
      refreshCb();
    });
  }

  showCsvModal(refreshCb) {
    const modalHTML = `
      <div id="csv-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-2xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span>📁</span> นำเข้าข้อมูลนักเรียนผ่านไฟล์ CSV
            </h3>
            <button id="close-csv-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <div class="space-y-4 mt-4">
            <div class="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-800">
              💡 <strong>รูปแบบหัวข้อไฟล์ CSV:</strong>
              <div class="font-mono mt-1.5 text-[11px] bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800">
                รหัสนักเรียน,เลขที่,ชื่อ-สกุล,ชั้น,ห้อง<br>
                STD6710,1,สมศักดิ์ สุขใจ,ม.1,1<br>
                STD6711,2,à¸ªà¸¡à¸«à¸¡à¸²à¸¢ à¹€à¸ˆà¸£à¸´à¸ ,ม.1,1
              </div>
              <p class="mt-2 text-[11px] italic text-indigo-600">* รองรับทั้งภาษาไทยและภาษาต่างดาวเพี้ยน (ระบบใช้ <strong>decodeMojibakeThai</strong> ซ่อมให้อัตโนมัติ!)</p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5">อัปโหลดไฟล์ .csv จากคอมพิวเตอร์ของคุณ</label>
              <input type="file" id="csv-file-input" accept=".csv,.txt" class="hidden">
              <div id="csv-dropzone" class="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 p-6 rounded-2xl text-center cursor-pointer transition-all">
                <div class="text-3xl mb-2">📁</div>
                <div id="dropzone-text" class="text-xs font-heading font-bold text-indigo-700">
                  คลิกที่นี่เพื่อเลือกไฟล์ .csv จากคอมพิวเตอร์ หรือลากไฟล์มาวาง
                </div>
                <div class="text-[11px] text-slate-400 mt-1">รองรับไฟล์ประเภท .csv และ .txt (UTF-8 / ANSI)</div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">หรือวางเนื้อหาข้อความจาก CSV</label>
              <textarea id="csv-text" rows="4" class="input-field font-mono text-xs" placeholder="วางข้อความจาก CSV ที่นี่..."></textarea>
            </div>

            <div class="flex justify-between items-center pt-4 border-t border-slate-100">
              <button id="btn-load-sample-csv" class="text-xs font-bold font-heading text-indigo-600 hover:underline">
                ✨ โหลดข้อความ CSV ตัวอย่าง
              </button>
              <div class="flex gap-3">
                <button type="button" id="close-csv-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
                <button id="btn-process-csv" class="btn-primary px-6 py-2 rounded-xl text-sm font-medium font-heading">นำเข้าข้อมูล</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('csv-modal');
    const fileInput = modalEl.querySelector('#csv-file-input');
    const dropzone = modalEl.querySelector('#csv-dropzone');
    const dropzoneText = modalEl.querySelector('#dropzone-text');
    const textarea = modalEl.querySelector('#csv-text');

    modalEl.querySelectorAll('#close-csv-modal, #close-csv-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    dropzone.addEventListener('click', () => fileInput.click());

    const handleFile = (file) => {
      if (!file) return;
      dropzoneText.innerHTML = `✅ เลือกไฟล์เรียบร้อย: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        textarea.value = ev.target.result;
      };
      reader.readAsText(file);
    };

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-600', 'bg-indigo-100/60');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-indigo-600', 'bg-indigo-100/60');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-600', 'bg-indigo-100/60');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    modalEl.querySelector('#btn-load-sample-csv').addEventListener('click', () => {
      textarea.value = `รหัสนักเรียน,เลขที่,ชื่อ-สกุล,ชั้น,ห้อง\nSTD6710,1,สมศักดิ์ สุขใจ,ม.1,1\nSTD6711,2,à¸ªà¸¡à¸«à¸¡à¸²à¸¢ à¹€à¸ˆà¸£à¸´à¸ ,ม.1,1\nSTD6712,3,à¸§à¸´à¸ à¸”à¸² à¹ à¸ªà¸‡,ม.1,1`;
    });

    modalEl.querySelector('#btn-process-csv').addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        await showAlertModal({ title: '⚠️ กรุณาระบุข้อมูล', message: 'กรุณาอัปโหลดไฟล์ .csv หรือวางเนื้อหา CSV เพื่อนำเข้าข้อมูล' });
        return;
      }

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        await showAlertModal({ title: '⚠️ รูปแบบไม่ถูกต้อง', message: 'รูปแบบ CSV ต้องมีอย่างน้อย 2 บรรทัด (Header และ Data)' });
        return;
      }

      const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let stdIdIdx = rawHeaders.findIndex(h => h.includes('รหัส') || h.includes('studentid') || h.includes('id'));
      let noIdx = rawHeaders.findIndex(h => h.includes('เลขที่') || h.includes('no') || h.includes('seat'));
      let nameIdx = rawHeaders.findIndex(h => h.includes('ชื่อ') || h.includes('name'));
      let gradeIdx = rawHeaders.findIndex(h => h.includes('ชั้น') || h.includes('grade'));
      let roomIdx = rawHeaders.findIndex(h => h.includes('ห้อง') || h.includes('room'));

      if (stdIdIdx === -1) stdIdIdx = 0;
      if (noIdx === -1) noIdx = 1;
      if (nameIdx === -1) nameIdx = 2;
      if (gradeIdx === -1) gradeIdx = 3;
      if (roomIdx === -1) roomIdx = 4;

      const parsedStudents = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length >= 3) {
          const stdId = cols[stdIdIdx] || `STD67${10 + i}`;
          parsedStudents.push({
            studentId: stdId,
            no: cols[noIdx] || `${i}`,
            name: decodeMojibakeThai(cols[nameIdx] || ''),
            grade: decodeMojibakeThai(cols[gradeIdx] || 'ม.1'),
            room: cols[roomIdx] || '1',
            email: `${stdId.toLowerCase()}@student.ac.th`,
            role: 'Student'
          });
        }
      }

      firebaseService.importStudents(parsedStudents);
      modalEl.remove();

      await showAlertModal({
        title: '✨ นำเข้าข้อมูลสำเร็จ',
        message: `นำเข้านักเรียนจากไฟล์ CSV เรียบร้อยแล้วจำนวน ${parsedStudents.length} รายการ`,
        type: 'success'
      });

      refreshCb();
    });
  }

  showBatchDeleteModal(refreshCb) {
    const users = firebaseService.getCollection('users');
    const students = users.filter(u => u.role === 'Student');

    const grades = [...new Set(students.map(s => s.grade).filter(g => g && g !== '-'))];
    const rooms = [...new Set(students.map(s => s.room).filter(r => r && r !== '-'))];

    const modalHTML = `
      <div id="batch-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-rose-600 font-heading flex items-center gap-2">
              <span>🗑️</span> ลบข้อมูลนักเรียนยกห้อง / ยกชั้น
            </h3>
            <button id="close-batch-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <div class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">เลือกประเภทการลบ</label>
              <select id="batch-type" class="input-field">
                <option value="room">ลบยกห้อง (เฉพาะห้องที่เลือก)</option>
                <option value="grade">ลบยกระดับชั้น (เช่น ม.1 ทั้งหมด)</option>
              </select>
            </div>

            <div id="batch-val-container">
              <label class="block text-xs font-semibold text-slate-600 mb-1">เลือกระบุห้อง</label>
              <select id="batch-val" class="input-field">
                ${rooms.map(r => `<option value="${r}">ห้อง ${r}</option>`).join('')}
              </select>
            </div>

            <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
              ⚠️ <strong>การดำเนินการนี้ไม่สามารถย้อนกลับได้:</strong> รายชื่อนักเรียนและข้อมูลการเข้าเรียนในกลุ่มดังกล่าวจะถูกลบออกจากระบบ
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-batch-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button id="btn-confirm-batch-del" class="bg-rose-600 hover:bg-rose-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm font-heading shadow-md shadow-rose-600/20">ยืนยันลบข้อมูล</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('batch-modal');

    modalEl.querySelectorAll('#close-batch-modal, #close-batch-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    const typeSelect = modalEl.querySelector('#batch-type');
    const valContainer = modalEl.querySelector('#batch-val-container');

    typeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'room') {
        valContainer.innerHTML = `
          <label class="block text-xs font-semibold text-slate-600 mb-1">เลือกระบุห้อง</label>
          <select id="batch-val" class="input-field">
            ${rooms.map(r => `<option value="${r}">ห้อง ${r}</option>`).join('')}
          </select>
        `;
      } else {
        valContainer.innerHTML = `
          <label class="block text-xs font-semibold text-slate-600 mb-1">เลือกระดับชั้น</label>
          <select id="batch-val" class="input-field">
            ${grades.map(g => `<option value="${g}">${g}</option>`).join('')}
          </select>
        `;
      }
    });

    modalEl.querySelector('#btn-confirm-batch-del').addEventListener('click', async () => {
      const type = typeSelect.value;
      const val = modalEl.querySelector('#batch-val').value;

      const confirmed = await showConfirmModal({
        title: '🔥 ยืนยันการลบนักเรียนยกกลุ่ม',
        message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายชื่อนักเรียนกลุ่ม ${type === 'room' ? `ห้อง ${val}` : `ชั้น ${val}`} ทั้งหมด?`,
        confirmText: 'ลบยกกลุ่มทันที'
      });

      if (confirmed) {
        const count = firebaseService.batchDeleteStudents(type, val);
        modalEl.remove();
        await showAlertModal({
          title: '🗑️ ลบข้อมูลเรียบร้อย',
          message: `ลบรายชื่อนักเรียนเรียบร้อยแล้วจำนวน ${count} รายการ`,
          type: 'success'
        });
        refreshCb();
      }
    });
  }
}
