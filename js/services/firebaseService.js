/**
 * Firebase Realtime Database Connector
 * Re-exports FirebaseRealtimeService for backward compatibility across all application modules.
 */

import { firebaseRealtimeService } from './firebaseRealtimeService.js';

export const firebaseService = firebaseRealtimeService;
export default firebaseService;
