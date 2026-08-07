/**
 * Firebase Realtime Database Service (Central Primary Server Engine)
 * Project: remediation-school
 * Database Location: Singapore (asia-southeast1)
 * Database URL: https://remediation-school-default-rtdb.asia-southeast1.firebasedatabase.app
 * 
 * Architecture & Deletion Persistence Fix:
 * 1. 🌐 Central Primary Server (Single Source of Truth):
 *    - All devices connect directly to Firebase Realtime Database Singapore Node.
 *    - Sentinel Flag `_system_seeded` prevents deleted items from ever being re-seeded!
 * 2. 📱 LocalStorage (Offline Backup & Fast Startup Cache):
 *    - Holds active user data without restoring deleted items.
 * 3. 🎯 Atomic Quiz Submission Engine:
 *    - Quiz results are written to atomic child keys (`quizzes/qz_xxx/results/res_yyy`) so multi-student submissions NEVER overwrite each other!
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set, update, remove, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { INITIAL_USERS, INITIAL_COURSES, INITIAL_ANNOUNCEMENTS, INITIAL_HOMEWORK, SAMPLE_QUIZ, INITIAL_ATTENDANCE } from './sampleDataService.js';
import { autoFixObjectMojibake } from './mojibakeDecoder.js';

export const FIREBASE_CONFIG = {
  projectId: "remediation-school",
  databaseURL: "https://remediation-school-default-rtdb.asia-southeast1.firebasedatabase.app"
};

class FirebaseRealtimeService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isRealtimeConnected = false;
    this.collections = ['users', 'courses', 'homework', 'quizzes', 'announcements', 'attendance', 'clubs'];

    // Seed local cache defaults if empty
    this.initLocalDefaults();

    // Initialize Firebase Connection
    this.initFirebaseRealtime();
  }

  initLocalDefaults() {
    if (localStorage.getItem('ag_users') === null) localStorage.setItem('ag_users', JSON.stringify(INITIAL_USERS));
    if (localStorage.getItem('ag_courses') === null) localStorage.setItem('ag_courses', JSON.stringify(INITIAL_COURSES));
    if (localStorage.getItem('ag_homework') === null) localStorage.setItem('ag_homework', JSON.stringify(INITIAL_HOMEWORK));
    if (localStorage.getItem('ag_quizzes') === null) localStorage.setItem('ag_quizzes', JSON.stringify([SAMPLE_QUIZ]));
    if (localStorage.getItem('ag_announcements') === null) localStorage.setItem('ag_announcements', JSON.stringify(INITIAL_ANNOUNCEMENTS));
    if (localStorage.getItem('ag_attendance') === null) localStorage.setItem('ag_attendance', JSON.stringify(INITIAL_ATTENDANCE));
    if (localStorage.getItem('ag_clubs') === null) localStorage.setItem('ag_clubs', JSON.stringify([]));
  }

  normalizeItem(item) {
    if (!item) return item;
    // Normalize quiz results map -> array if stored as child keys in Firebase Realtime DB
    if (item.results && typeof item.results === 'object' && !Array.isArray(item.results)) {
      item.results = Object.keys(item.results)
        .filter(rk => rk !== '_placeholder' && rk !== '_empty')
        .map(rk => {
          const resObj = item.results[rk];
          return typeof resObj === 'object' && resObj !== null ? { id: rk, ...resObj } : resObj;
        });
    }
    return item;
  }

  // 🌐 Initialize Central Firebase Realtime Database & Setup 0.1s Cross-Device Sync
  async initFirebaseRealtime() {
    try {
      this.app = initializeApp(FIREBASE_CONFIG);
      this.db = getDatabase(this.app, FIREBASE_CONFIG.databaseURL);
      this.isRealtimeConnected = true;
      console.log('🌐 Connected to Central Primary Server (Singapore asia-southeast1 Realtime DB)');

      // 1. Seed Central Database ONLY ONCE via sentinel node check
      await this.ensureCentralServerSeeded();

      // 2. Attach Live Subscriptions across all connected devices (0.1s sync)
      this.collections.forEach(key => {
        const colRef = ref(this.db, key);
        onValue(colRef, (snapshot) => {
          const val = snapshot.val();
          let itemsArray = [];
          
          if (val) {
            if (Array.isArray(val)) {
              itemsArray = val
                .filter(item => item && typeof item === 'object' && !item._placeholder)
                .map(item => this.normalizeItem(item));
            } else if (typeof val === 'object') {
              itemsArray = Object.keys(val)
                .filter(k => k !== '_empty' && k !== '_placeholder')
                .map(k => {
                  const item = val[k];
                  const cleanItem = typeof item === 'object' && item !== null ? { id: k, ...item } : item;
                  return this.normalizeItem(cleanItem);
                })
                .filter(item => item && typeof item === 'object' && !item._placeholder);
            }
          }

          // Save exact server array state (even if empty `[]`)
          localStorage.setItem('ag_' + key, JSON.stringify(itemsArray));
          
          // Broadcast live update to refresh active UI across all connected devices
          window.dispatchEvent(new CustomEvent('ag_realtime_update', {
            detail: { collection: key, items: itemsArray }
          }));
        });
      });
    } catch (err) {
      console.warn('Central server connection warning (using offline local cache):', err);
      this.isRealtimeConnected = false;
    }
  }

  // Ensure Central Server has initial seed data ONLY ONCE using master sentinel flag
  async ensureCentralServerSeeded() {
    if (!this.db) return;
    try {
      const sentinelRef = ref(this.db, '_system_seeded');
      const snapshot = await get(sentinelRef);

      // If system has ALREADY been seeded once, NEVER re-seed deleted items!
      if (snapshot.exists() && snapshot.val() === true) {
        return;
      }

      console.log('🌱 First-Time System Initialization: Seeding central server with initial dataset...');
      await set(ref(this.db, 'users'), this.arrayToMap(INITIAL_USERS));
      await set(ref(this.db, 'courses'), this.arrayToMap(INITIAL_COURSES));
      await set(ref(this.db, 'homework'), this.arrayToMap(INITIAL_HOMEWORK));
      await set(ref(this.db, 'quizzes'), this.arrayToMap([SAMPLE_QUIZ]));
      await set(ref(this.db, 'announcements'), this.arrayToMap(INITIAL_ANNOUNCEMENTS));
      await set(ref(this.db, 'attendance'), this.arrayToMap(INITIAL_ATTENDANCE));
      await set(ref(this.db, 'clubs'), this.arrayToMap([]));
      
      // Set Sentinel Flag so system never re-seeds deleted items
      await set(sentinelRef, true);
    } catch (e) {
      console.warn('Central seed check notice:', e);
    }
  }

  arrayToMap(arr) {
    const map = {};
    if (Array.isArray(arr) && arr.length > 0) {
      arr.forEach(item => {
        if (item && item.id) map[item.id] = item;
      });
    } else {
      map['_placeholder'] = { id: '_placeholder', _placeholder: true };
    }
    return map;
  }

  // 📱 Read Collection (Reads from Central Server Data Cache with Mojibake Repair)
  getCollection(key) {
    const raw = localStorage.getItem('ag_' + key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return autoFixObjectMojibake(parsed.map(item => this.normalizeItem(item)));
        }
      } catch (e) {
        // Fallback
      }
    }

    // Fallback to initial seed dataset ONLY if key NEVER existed in localStorage
    if (key === 'users') return INITIAL_USERS;
    if (key === 'courses') return INITIAL_COURSES;
    if (key === 'homework') return INITIAL_HOMEWORK;
    if (key === 'quizzes') return [SAMPLE_QUIZ];
    if (key === 'announcements') return INITIAL_ANNOUNCEMENTS;
    if (key === 'attendance') return INITIAL_ATTENDANCE;

    return [];
  }

  // Save Collection
  saveCollection(key, items) {
    localStorage.setItem('ag_' + key, JSON.stringify(items));
    if (this.isRealtimeConnected && this.db) {
      const colRef = ref(this.db, key);
      set(colRef, this.arrayToMap(items)).catch(err => console.warn('Central server save error:', err));
    }
  }

  // 🌐 Write / Add Item to Central Primary Server
  async addItem(collectionKey, item) {
    const newItem = { ...item, id: item.id || (collectionKey.slice(0,3) + '_' + Date.now() + '_' + Math.random().toString(36).substr(2,4)) };
    const cleanItem = this.sanitizeForFirebase(newItem);
    
    // Update local cache for optimistic response
    const items = this.getCollection(collectionKey);
    const existingIdx = items.findIndex(x => x.id === cleanItem.id);
    if (existingIdx !== -1) {
      items[existingIdx] = cleanItem;
    } else {
      items.unshift(cleanItem);
    }
    localStorage.setItem('ag_' + collectionKey, JSON.stringify(items));

    // Broadcast local addition immediately
    window.dispatchEvent(new CustomEvent('ag_realtime_update', {
      detail: { collection: collectionKey, items: items }
    }));

    // Push to Central Server immediately
    if (this.isRealtimeConnected && this.db) {
      const itemRef = ref(this.db, `${collectionKey}/${cleanItem.id}`);
      await set(itemRef, cleanItem).catch(err => console.error('Central server addItem error:', err));
    }
    return cleanItem;
  }

  // 🌐 Update Item on Central Primary Server
  async updateItem(collectionKey, id, updates) {
    const items = this.getCollection(collectionKey);
    const index = items.findIndex(x => x.id === id);
    if (index !== -1) {
      const cleanUpdates = this.sanitizeForFirebase(updates);
      items[index] = { ...items[index], ...cleanUpdates };
      localStorage.setItem('ag_' + collectionKey, JSON.stringify(items));

      // Broadcast local update immediately
      window.dispatchEvent(new CustomEvent('ag_realtime_update', {
        detail: { collection: collectionKey, items: items }
      }));

      if (this.isRealtimeConnected && this.db) {
        const itemRef = ref(this.db, `${collectionKey}/${id}`);
        await update(itemRef, cleanUpdates).catch(err => console.error('Central server updateItem error:', err));
      }
      return items[index];
    }
    return null;
  }

  // 🌐 Delete Item from Central Primary Server (With Permanent Node Deletion Fix)
  async deleteItem(collectionKey, id) {
    let items = this.getCollection(collectionKey);
    items = items.filter(x => x.id !== id);
    localStorage.setItem('ag_' + collectionKey, JSON.stringify(items));

    // Broadcast local deletion immediately so UI updates in 0ms across devices
    window.dispatchEvent(new CustomEvent('ag_realtime_update', {
      detail: { collection: collectionKey, items: items }
    }));

    if (this.isRealtimeConnected && this.db) {
      const itemRef = ref(this.db, `${collectionKey}/${id}`);
      if (items.length === 0) {
        // Leave placeholder node so Firebase doesn't auto-delete the parent key
        await set(ref(this.db, `${collectionKey}/_placeholder`), { id: '_placeholder', _placeholder: true });
      }
      await remove(itemRef).catch(err => console.warn('Central server deleteItem error:', err));
    }
    return true;
  }

  // 🎯 ATOMIC QUIZ RESULT SUBMISSION (Prevents overwriting scores when multiple students submit together)
  async addQuizResult(quizId, newResult) {
    const cleanResult = this.sanitizeForFirebase(newResult);

    // 1. Update local cache immediately
    const items = this.getCollection('quizzes');
    const quiz = items.find(q => q.id === quizId);
    if (quiz) {
      if (!Array.isArray(quiz.results)) quiz.results = [];
      // Remove duplicate if re-submitting same attempt ID
      quiz.results = quiz.results.filter(r => r.id !== newResult.id);
      quiz.results.push(cleanResult);
      localStorage.setItem('ag_quizzes', JSON.stringify(items));

      window.dispatchEvent(new CustomEvent('ag_realtime_update', {
        detail: { collection: 'quizzes', items: items }
      }));
    }

    // 2. Write ATOMICALLY to specific child key in Firebase DB (Never overwrites other students!)
    if (this.isRealtimeConnected && this.db) {
      const resRef = ref(this.db, `quizzes/${quizId}/results/${newResult.id}`);
      await set(resRef, cleanResult).catch(err => console.warn('Realtime addQuizResult error:', err));
    }
  }

  // 🎯 ATOMIC QUIZ RESULT DELETION (Deletes ONLY single attempt by ID)
  async deleteQuizResult(quizId, resultId) {
    // 1. Update local cache immediately
    const items = this.getCollection('quizzes');
    const quiz = items.find(q => q.id === quizId);
    if (quiz && Array.isArray(quiz.results)) {
      quiz.results = quiz.results.filter(r => (r.id ? r.id !== resultId : (r.studentId + '_' + (r.completedAt || '')) !== resultId));
      localStorage.setItem('ag_quizzes', JSON.stringify(items));

      window.dispatchEvent(new CustomEvent('ag_realtime_update', {
        detail: { collection: 'quizzes', items: items }
      }));
    }

    // 2. Remove ATOMICALLY from specific child key in Firebase DB
    if (this.isRealtimeConnected && this.db) {
      const resRef = ref(this.db, `quizzes/${quizId}/results/${resultId}`);
      await remove(resRef).catch(err => console.warn('Realtime deleteQuizResult error:', err));
    }
  }

  // Helper method to sanitize object before sending to Firebase
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
          const val = obj[k];
          if (val !== undefined) {
            clean[k] = this.sanitizeForFirebase(val);
          }
        }
      }
      return clean;
    }
    return obj;
  }

  // Batch Import / Add Students
  async batchAddStudents(studentsList) {
    const current = this.getCollection('users');
    studentsList.forEach(st => {
      const existingIdx = current.findIndex(u => (u.studentId && st.studentId && u.studentId === st.studentId) || (u.username && st.username && u.username === st.username));
      if (existingIdx !== -1) {
        current[existingIdx] = { ...current[existingIdx], ...st };
      } else {
        current.push({ ...st, id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2,4) });
      }
    });

    this.saveCollection('users', current);
    return current;
  }

  async importStudents(studentsList) {
    return await this.batchAddStudents(studentsList);
  }

  // Batch Delete Students
  async batchDeleteStudents(filterType, filterValue) {
    let users = this.getCollection('users');
    const initialCount = users.length;

    users = users.filter(u => {
      if (u.role !== 'Student') return true;
      if (filterType === 'room' && u.room === filterValue) return false;
      if (filterType === 'grade' && u.grade === filterValue) return false;
      return true;
    });

    const deletedCount = initialCount - users.length;
    this.saveCollection('users', users);
    return deletedCount;
  }

  // Quiz Draft Auto-append
  async appendQuizDraft(quizData) {
    const quizzes = this.getCollection('quizzes');
    const existingIndex = quizzes.findIndex(q => q.id === quizData.id);
    
    if (existingIndex !== -1) {
      quizzes[existingIndex] = quizData;
    } else {
      quizzes.unshift(quizData);
    }

    this.saveCollection('quizzes', quizzes);
    localStorage.setItem('antigravity_quiz_draft', JSON.stringify(quizData));
    return quizData;
  }

  getQuizDraft() {
    const raw = localStorage.getItem('antigravity_quiz_draft');
    if (!raw) return null;
    try {
      return autoFixObjectMojibake(JSON.parse(raw));
    } catch(e) {
      return null;
    }
  }

  clearQuizDraft() {
    localStorage.removeItem('antigravity_quiz_draft');
  }
}

export const firebaseRealtimeService = new FirebaseRealtimeService();
export const firebaseService = firebaseRealtimeService;
