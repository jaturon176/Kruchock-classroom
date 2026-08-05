/**
 * Custom Dialog & Modal Service
 * Replaces native browser alert/confirm with modern glassmorphic popups.
 */

export function showConfirmModal({
  title = '⚠️ ยืนยันการลบข้อมูล',
  message = 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้? การดำเนินการนี้จะไม่สามารถย้อนกลับได้',
  confirmText = '🗑️ ยืนยันลบข้อมูล',
  cancelText = 'ยกเลิก',
  type = 'danger' // 'danger' | 'warning' | 'info'
} = {}) {
  return new Promise((resolve) => {
    const isDanger = type === 'danger';
    
    const modalHTML = `
      <div id="custom-confirm-modal" class="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-2xl relative border ${isDanger ? 'border-rose-500/30' : 'border-indigo-500/30'} space-y-5 animate-scale-up">
          
          <!-- Header Icon & Title -->
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-2xl ${isDanger ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'} flex items-center justify-center text-2xl font-bold shrink-0">
              ${isDanger ? '🗑️' : '❓'}
            </div>
            <div>
              <h3 class="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">${title}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${message}</p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end items-center gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-700/60">
            <button id="modal-cancel-btn" class="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-xs font-semibold transition-colors">
              ${cancelText}
            </button>
            <button id="modal-confirm-btn" class="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
              isDanger 
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-600/30'
            }">
              ${confirmText}
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('custom-confirm-modal');

    const cancelBtn = modalEl.querySelector('#modal-cancel-btn');
    const confirmBtn = modalEl.querySelector('#modal-confirm-btn');

    const cleanup = (result) => {
      modalEl.classList.add('opacity-0', 'transition-opacity', 'duration-200');
      setTimeout(() => {
        modalEl.remove();
        resolve(result);
      }, 150);
    };

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));

    // Close on backdrop click
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) cleanup(false);
    });
  });
}

export function showAlertModal({
  title = '🔔 แจ้งเตือนจากระบบ',
  message = '',
  buttonText = 'ตกลง',
  type = 'info'
} = {}) {
  return new Promise((resolve) => {
    const isSuccess = type === 'success';
    
    const modalHTML = `
      <div id="custom-alert-modal" class="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-2xl relative border ${isSuccess ? 'border-emerald-500/30' : 'border-indigo-500/30'} space-y-5">
          
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-2xl ${isSuccess ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'} flex items-center justify-center text-2xl font-bold shrink-0">
              ${isSuccess ? '✨' : '🔔'}
            </div>
            <div>
              <h3 class="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">${title}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${message}</p>
            </div>
          </div>

          <div class="flex justify-end pt-4 border-t border-slate-200/80 dark:border-slate-700/60">
            <button id="alert-ok-btn" class="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg">
              ${buttonText}
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('custom-alert-modal');
    const okBtn = modalEl.querySelector('#alert-ok-btn');

    okBtn.addEventListener('click', () => {
      modalEl.remove();
      resolve(true);
    });
  });
}

export function showImagePreviewModal(options = {}) {
  let imageUrl = '';
  let title = '🖼️ รูปภาพชิ้นงานของนักเรียน';
  let studentName = '';

  if (typeof options === 'string') {
    imageUrl = options;
  } else if (options && typeof options === 'object') {
    imageUrl = options.imageUrl || options.url || options.src || '';
    if (options.title) title = options.title;
    if (options.studentName) studentName = options.studentName;
  }

  return new Promise((resolve) => {
    const modalHTML = `
      <div id="custom-image-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-4xl p-6 rounded-3xl shadow-2xl relative border border-slate-700/60 bg-slate-900 text-white max-h-[92vh] flex flex-col space-y-4 animate-scale-up">
          
          <!-- Header Bar -->
          <div class="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-xl">📸</span>
              <div>
                <h3 class="text-base font-bold font-heading text-slate-100">${title}</h3>
                ${studentName ? `<p class="text-xs text-slate-400 font-heading">เจ้าของชิ้นงาน: <strong class="text-amber-400 font-bold">${studentName}</strong></p>` : ''}
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <a href="${imageUrl}" download target="_blank" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all flex items-center gap-1">
                <span>⬇️</span> ดาวน์โหลดรูป
              </a>
              <button id="close-img-modal-btn" class="w-9 h-9 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center text-lg font-bold transition-all">
                ✕
              </button>
            </div>
          </div>

          <!-- Image Preview Area -->
          <div class="flex-1 overflow-auto flex items-center justify-center bg-slate-950/80 rounded-2xl p-3 border border-slate-800/80 min-h-[300px]">
            <img src="${imageUrl}" class="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-transform hover:scale-[1.02]">
          </div>

          <!-- Footer -->
          <div class="flex justify-between items-center pt-2 text-xs text-slate-400 border-t border-slate-800 shrink-0">
            <span class="text-[11px] text-slate-500">☁️ จัดเก็บไฟล์รูปบน Cloudinary CDN (gibfwtj2) ความคมชัดสูง</span>
            <button id="close-img-modal-footer-btn" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-heading transition-all shadow-md">
              ปิดหน้าต่างรูปภาพ
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('custom-image-modal');

    const cleanup = () => {
      modalEl.classList.add('opacity-0', 'transition-opacity', 'duration-150');
      setTimeout(() => {
        modalEl.remove();
        resolve(true);
      }, 150);
    };

    modalEl.querySelectorAll('#close-img-modal-btn, #close-img-modal-footer-btn').forEach(b => b.addEventListener('click', cleanup));

    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) cleanup();
    });
  });
}
