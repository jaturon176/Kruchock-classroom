/**
 * System Settings Module
 * Manages school info, banner titles, rich background theme presets (10+ presets + Custom Color Picker),
 * and comprehensive system-wide preferences (sound effects, digital clock, page sizes, permissions).
 */

import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal } from '../services/dialogService.js';

export const THEME_PRESETS = [
  { id: 'ocean', name: 'Ocean Breeze (ฟ้าพาสเทล)', bgClass: 'bg-sky-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.08) 0px, transparent 50%)', primary: '#0284c7', description: 'โทนสีฟ้าพาสเทล ละมุนตา เหมาะกับการเรียนรู้' },
  { id: 'mint', name: 'Emerald Mint (เขียวมิ้นต์)', bgClass: 'bg-emerald-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(20, 184, 166, 0.12) 0px, transparent 50%)', primary: '#059669', description: 'โทนสีเขียวมิ้นต์ สดชื่น ผ่อนคลายสายตา' },
  { id: 'slate', name: 'Classic Slate (เทาเรียบหรู)', bgClass: 'bg-slate-100', bgStyle: 'radial-gradient(at 0% 0%, rgba(148, 163, 184, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(71, 85, 105, 0.12) 0px, transparent 50%)', primary: '#475569', description: 'โทนสีเทาเรียบหรู สบายตา อ่านง่าย' },
  { id: 'sakura', name: 'Sakura Blossom (ชมพูพาสเทล)', bgClass: 'bg-pink-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(244, 114, 182, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(219, 39, 119, 0.1) 0px, transparent 50%)', primary: '#db2777', description: 'โทนสีชมพูพาสเทล อบอุ่น อ่อนโยน' },
  { id: 'lavender', name: 'Lavender Dream (ม่วงพาสเทล)', bgClass: 'bg-purple-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(192, 132, 252, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(147, 51, 234, 0.1) 0px, transparent 50%)', primary: '#9333ea', description: 'โทนสีม่วงลาเวนเดอร์ ผ่อนคลาย นุ่มนวล' },
  { id: 'peach', name: 'Sunset Peach (ส้มพาสเทล)', bgClass: 'bg-amber-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(251, 146, 60, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.1) 0px, transparent 50%)', primary: '#d97706', description: 'โทนสีส้มพีช อบอุ่น มีชีวิตชีวา' },
  { id: 'cyan', name: 'Cyber Cyan (ฟ้าไซเบอร์)', bgClass: 'bg-cyan-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(34, 211, 238, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.1) 0px, transparent 50%)', primary: '#0891b2', description: 'โทนสีฟ้าไซเบอร์ ล้ำสมัย สดใส' },
  { id: 'rose', name: 'Rose Gold (ชมพูกุหลาบ)', bgClass: 'bg-rose-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(251, 113, 133, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(225, 29, 72, 0.1) 0px, transparent 50%)', primary: '#e11d48', description: 'โทนสีชมพูกุหลาบ พรีเมียม หรูหรา' },
  { id: 'teal', name: 'Ocean Teal (เขียวฟ้าทะเล)', bgClass: 'bg-teal-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(45, 212, 191, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(13, 148, 136, 0.1) 0px, transparent 50%)', primary: '#0d9488', description: 'โทนสีเขียวฟ้าทะเล ลึกซึ้ง เย็นสบาย' },
  { id: 'midnight', name: 'Midnight Indigo (ม่วงฟิวเจอร์)', bgClass: 'bg-indigo-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(129, 140, 248, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(79, 70, 229, 0.12) 0px, transparent 50%)', primary: '#4f46e5', description: 'โทนสีม่วงอินดิโก้ สไตล์ Futuristic' }
];

export class SettingsModule {
  constructor(rbac, onSettingsChange) {
    this.rbac = rbac;
    this.onSettingsChange = onSettingsChange;
    this.initSettings();
  }

  initSettings() {
    const raw = localStorage.getItem('antigravity_school_settings');
    if (!raw) {
      this.settings = {
        schoolName: 'โรงเรียนพนมดงรักวิทยา',
        academicYear: '2026',
        semester: 'ภาคเรียนที่ 1',
        theme: 'ocean',
        customBgColor: '',
        bannerTitle: 'ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่',
        showClock: true,
        pageSize: 10,
        allowStudentAvatar: true
      };
      this.saveSettings();
    } else {
      try {
        this.settings = {
          schoolName: 'โรงเรียนพนมดงรักวิทยา',
          academicYear: '2026',
          semester: 'ภาคเรียนที่ 1',
          theme: 'ocean',
          customBgColor: '',
          bannerTitle: 'ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่',
          showClock: true,
          pageSize: 10,
          allowStudentAvatar: true,
          ...JSON.parse(raw)
        };
      } catch (e) {
        this.settings = {
          schoolName: 'โรงเรียนพนมดงรักวิทยา',
          academicYear: '2026',
          semester: 'ภาคเรียนที่ 1',
          theme: 'ocean',
          customBgColor: '',
          bannerTitle: 'ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่',
          showClock: true,
          pageSize: 10,
          allowStudentAvatar: true
        };
      }
    }
    this.applyTheme();
  }

  getSettings() {
    return this.settings;
  }

  saveSettings() {
    localStorage.setItem('antigravity_school_settings', JSON.stringify(this.settings));
    this.applyTheme();
  }

  // Directly apply theme gradient / custom background color to body
  applyTheme() {
    const customColor = this.settings.customBgColor;
    if (customColor) {
      document.body.style.backgroundColor = customColor;
      document.body.style.backgroundImage = 'none';
      return;
    }

    const themeId = this.settings.theme || 'ocean';
    const preset = THEME_PRESETS.find(p => p.id === themeId) || THEME_PRESETS[0];

    document.body.style.backgroundColor = '#f8fafc';
    document.body.style.backgroundImage = preset.bgStyle;
    document.body.style.backgroundAttachment = 'fixed';
  }

  render(containerEl) {
    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in max-w-5xl mx-auto">
        <!-- Header -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex items-center justify-between bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100 text-xl">⚙️</span>
              ตั้งค่าระบบและธีมพื้นหลัง (System Settings & Customization)
            </h2>
            <p class="text-slate-500 text-xs mt-1">กำหนดชื่อโรงเรียน, เลือกธีมสีพื้นหลัง 10+ แบบ + เลือกสีเองได้, และตั้งค่าการทำงานแอปพลิเคชัน</p>
          </div>
        </div>

        <!-- Section 1: School Profile Settings -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-6">
          <h3 class="text-lg font-bold font-heading text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>🏫</span> 1. ข้อมูลสถานศึกษาและแบนเนอร์
          </h3>

          <form id="settings-school-form" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อสถานศึกษา / โรงเรียน</label>
              <input type="text" id="set-school-name" value="${decodeMojibakeThai(this.settings.schoolName)}" required class="input-field" placeholder="โรงเรียนพนมดงรักวิทยา">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ข้อความหัวข้อแบนเนอร์หน้าแรก (Banner Title)</label>
              <input type="text" id="set-banner-title" value="${decodeMojibakeThai(this.settings.bannerTitle || '')}" required class="input-field" placeholder="ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ปีการศึกษา</label>
                <input type="text" id="set-year" value="${this.settings.academicYear}" required class="input-field" placeholder="2026">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ภาคเรียน</label>
                <input type="text" id="set-semester" value="${this.settings.semester}" required class="input-field" placeholder="ภาคเรียนที่ 1">
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button type="submit" class="btn-primary text-xs px-6 py-2.5 rounded-xl font-heading font-bold shadow-md">
                💾 บันทึกข้อมูลโรงเรียน
              </button>
            </div>
          </form>
        </div>

        <!-- Section 2: Theme Presets & Custom Background Color Picker -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold font-heading text-slate-900 flex items-center gap-2">
              <span>🎨</span> 2. เลือกธีมสีพื้นหลังระบบ (Theme Presets & Custom Picker)
            </h3>

            <!-- Custom Color Picker Input -->
            <div class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
              <label class="text-xs font-bold text-slate-700">🎨 เลือกสีพื้นหลังเอง:</label>
              <input type="color" id="set-custom-bg" value="${this.settings.customBgColor || '#f8fafc'}" class="w-8 h-8 rounded-lg cursor-pointer border-0">
              ${this.settings.customBgColor ? `
                <button type="button" id="btn-reset-custom-bg" class="text-xs text-rose-600 font-bold hover:underline ml-1">
                  ล้างสี
                </button>
              ` : ''}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            ${THEME_PRESETS.map(preset => `
              <div 
                data-theme-id="${preset.id}" 
                class="p-4 rounded-2xl border cursor-pointer transition-all space-y-2 flex flex-col justify-between ${
                  !this.settings.customBgColor && this.settings.theme === preset.id 
                    ? 'ring-2 ring-sky-500 bg-sky-50/90 border-sky-400 shadow-md' 
                    : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                }"
              >
                <div class="flex items-center justify-between">
                  <div class="font-bold text-slate-900 text-sm font-heading">${preset.name}</div>
                  <span class="w-5 h-5 rounded-full border border-white shadow-sm" style="background-color: ${preset.primary}"></span>
                </div>
                <p class="text-xs text-slate-500">${preset.description}</p>
                <div class="text-[11px] font-bold ${!this.settings.customBgColor && this.settings.theme === preset.id ? 'text-sky-700' : 'text-slate-400'} pt-1">
                  ${!this.settings.customBgColor && this.settings.theme === preset.id ? '✓ ธีมปัจจุบัน' : 'คลิกเพื่อเปลี่ยนเป็นธีมนี้'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section 3: App Display & Behavior Settings -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-4">
          <h3 class="text-lg font-bold font-heading text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>⚙️</span> 3. ตั้งค่าการแสดงผลและพฤติกรรมแอปพลิเคชัน
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">⏰ แสดงนาฬิการายงานเวลาเรียลไทม์</div>
                <div class="text-[11px] text-slate-500 mt-0.5">แสดงนาฬิกาดิจิทัลและวันที่แบบไทยบนแบนเนอร์หน้าแรก</div>
              </div>
              <input type="checkbox" id="set-show-clock" ${this.settings.showClock ? 'checked' : ''} class="w-5 h-5 text-indigo-600 rounded cursor-pointer">
            </div>

            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">🖼️ อนุญาตให้นักเรียนเปลี่ยนรูปโปรไฟล์</div>
                <div class="text-[11px] text-slate-500 mt-0.5">ให้นักเรียนทุกคนสามารถอัปโหลดและเปลี่ยนรูปโปรไฟล์ได้เอง</div>
              </div>
              <input type="checkbox" id="set-allow-avatar" ${this.settings.allowStudentAvatar ? 'checked' : ''} class="w-5 h-5 text-indigo-600 rounded cursor-pointer">
            </div>
          </div>
        </div>
      </div>
    `;

    // Event Handlers for School Form
    containerEl.querySelector('#settings-school-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      this.settings.schoolName = document.getElementById('set-school-name').value.trim();
      this.settings.bannerTitle = document.getElementById('set-banner-title').value.trim();
      this.settings.academicYear = document.getElementById('set-year').value.trim();
      this.settings.semester = document.getElementById('set-semester').value.trim();

      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();

      await showAlertModal({
        title: '💾 บันทึกการตั้งค่าสำเร็จ',
        message: 'อัปเดตข้อมูลสถานศึกษาและภาคเรียนเรียบร้อยแล้ว',
        type: 'success'
      });
    });

    // Preset Theme Card Handlers
    containerEl.querySelectorAll('[data-theme-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        const themeId = e.currentTarget.dataset.themeId;
        this.settings.theme = themeId;
        this.settings.customBgColor = ''; // Reset custom color when preset is clicked
        this.saveSettings();
        if (this.onSettingsChange) this.onSettingsChange();
        this.render(containerEl);
      });
    });

    // Custom Color Picker Handler
    const colorPicker = containerEl.querySelector('#set-custom-bg');
    colorPicker?.addEventListener('input', (e) => {
      const val = e.target.value;
      this.settings.customBgColor = val;
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
    });

    // Reset Custom Color Handler
    containerEl.querySelector('#btn-reset-custom-bg')?.addEventListener('click', () => {
      this.settings.customBgColor = '';
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
      this.render(containerEl);
    });

    // App Preferences Checkboxes
    containerEl.querySelector('#set-show-clock')?.addEventListener('change', (e) => {
      this.settings.showClock = e.target.checked;
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
    });

    containerEl.querySelector('#set-allow-avatar')?.addEventListener('change', (e) => {
      this.settings.allowStudentAvatar = e.target.checked;
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
    });
  }
}
