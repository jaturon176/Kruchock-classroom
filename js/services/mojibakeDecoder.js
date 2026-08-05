/**
 * decodeMojibakeThai Utility
 * Detects and repairs garbled Thai text (Mojibake) caused by
 * UTF-8 <-> Windows-874 / ISO-8859-1 / TIS-620 encoding mismatches.
 */

export function decodeMojibakeThai(input) {
  if (typeof input !== 'string' || !input) return input;

  // Patterns common in double-encoded UTF-8 interpreted as Latin-1/Windows-1252
  // e.g., 'à¸ªà¸§à¸±à¸ªà¸”à¸µ', 'à¹€', 'à¸', etc.
  const mojibakeRegex = /(?:à¸[à-ÿ]|à¹[à-ÿ]|Ã[Â-ÿ]|Â[À-ÿ])+/g;

  if (!mojibakeRegex.test(input)) {
    // Also check single character byte shifts
    return tryByteRepair(input);
  }

  // Replace matched garbled fragments
  let repaired = input.replace(mojibakeRegex, (match) => {
    try {
      // Map Latin-1 char codes back to byte values
      const bytes = new Uint8Array(match.length);
      for (let i = 0; i < match.length; i++) {
        bytes[i] = match.charCodeAt(i) & 0xFF;
      }
      const utf8Decoder = new TextDecoder('utf-8');
      const decoded = utf8Decoder.decode(bytes);
      // Verify decoded contains valid Thai range (\u0E00-\u0E7F)
      if (/[\u0E00-\u0E7F]/.test(decoded)) {
        return decoded;
      }
      return match;
    } catch (e) {
      return match;
    }
  });

  return tryByteRepair(repaired);
}

function tryByteRepair(str) {
  // Secondary check for isolated garbled patterns
  if (str.includes('à¸') || str.includes('à¹')) {
    try {
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xFF;
      }
      const utf8Decoder = new TextDecoder('utf-8');
      const decoded = utf8Decoder.decode(bytes);
      if (/[\u0E00-\u0E7F]/.test(decoded)) {
        return decoded;
      }
    } catch (e) {
      // Return original if repair fails
    }
  }
  return str;
}

/**
 * Auto-repairs an entire object or array recursively
 */
export function autoFixObjectMojibake(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return decodeMojibakeThai(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => autoFixObjectMojibake(item));
  }
  if (typeof obj === 'object') {
    const fixed = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fixed[key] = autoFixObjectMojibake(obj[key]);
      }
    }
    return fixed;
  }
  return obj;
}
