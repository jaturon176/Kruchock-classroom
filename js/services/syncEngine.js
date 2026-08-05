/**
 * Optimistic UI & Background RPC Sync Engine
 * Handles instant UI state mutations while queuing tasks to push to Firestore in background.
 */

class SyncEngine {
  constructor() {
    this.queue = JSON.parse(localStorage.getItem('antigravity_sync_queue') || '[]');
    this.status = 'synced'; // 'synced' | 'syncing' | 'offline'
    this.listeners = new Set();
    this.isProcessing = false;
    this.online = navigator.onLine;

    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  handleNetworkChange(isOnline) {
    this.online = isOnline;
    if (!isOnline) {
      this.setStatus('offline');
    } else {
      this.setStatus(this.queue.length > 0 ? 'syncing' : 'synced');
      this.processQueue();
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getStatus();
    this.listeners.forEach(cb => cb(state));
  }

  getStatus() {
    return {
      status: this.status,
      pendingCount: this.queue.length,
      isOnline: this.online
    };
  }

  setStatus(newStatus) {
    this.status = newStatus;
    this.notify();
  }

  /**
   * Enqueue a sync task to be pushed asynchronously
   * @param {Object} task - { id, collection, action: 'add'|'update'|'delete', payload }
   */
  async enqueue(task, syncHandler) {
    const queueItem = {
      ...task,
      timestamp: Date.now(),
      id: task.id || 'sync_' + Math.random().toString(36).substr(2, 9)
    };

    this.queue.push({ item: queueItem, handlerName: syncHandler?.name || 'default' });
    this.persistQueue();
    
    if (this.online) {
      this.setStatus('syncing');
      this.processQueue(syncHandler);
    } else {
      this.setStatus('offline');
    }

    return queueItem;
  }

  persistQueue() {
    try {
      localStorage.setItem('antigravity_sync_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Queue storage overflow', e);
    }
  }

  async processQueue(customSyncHandler) {
    if (this.isProcessing || this.queue.length === 0 || !this.online) {
      if (this.queue.length === 0 && this.online) {
        this.setStatus('synced');
      }
      return;
    }

    this.isProcessing = true;
    this.setStatus('syncing');

    while (this.queue.length > 0 && this.online) {
      const current = this.queue[0];
      try {
        if (customSyncHandler) {
          await customSyncHandler(current.item);
        } else {
          // Simulate short network latency for smooth UI feedback
          await new Promise(res => setTimeout(res, 400));
        }
        // Remove processed item
        this.queue.shift();
        this.persistQueue();
      } catch (err) {
        console.error('Failed to sync item:', current, err);
        // On error, pause and retry later
        break;
      }
    }

    this.isProcessing = false;
    this.setStatus(this.queue.length > 0 ? (this.online ? 'syncing' : 'offline') : 'synced');
  }
}

export const syncEngine = new SyncEngine();
