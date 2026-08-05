/**
 * Cloudinary CDN & Base64 Data URL Image Upload Service
 * Cloud Name: n90bjay3
 * Uploads images to Cloudinary CDN for high-resolution cross-device viewing.
 * Fallback to compressed Base64 Data URL if offline or if CDN preset fails.
 */

import { compressImage } from './imageCompressor.js';

export const CLOUDINARY_CONFIG = {
  cloudName: 'n90bjay3',
  uploadPreset: 'kruchock_preset', // Unsigned upload preset
  uploadUrl: 'https://api.cloudinary.com/v1_1/n90bjay3/image/upload'
};

/**
 * Upload image to Cloudinary CDN with automatic compression & Data URL fallback
 * @param {File} file - Image File object
 * @param {number} maxWidth - Max width for compression
 * @param {number} quality - Compression quality
 * @returns {Promise<string>} Image URL (Cloudinary CDN URL or compressed Base64 Data URL)
 */
export async function uploadImageToCloudinary(file, maxWidth = 1200, quality = 0.8) {
  if (!file) return null;

  try {
    // 1. Compress image locally first for ultra-fast transfer
    const compressedDataUrl = await compressImage(file, maxWidth, quality);

    // If offline, return compressed Base64 Data URL immediately
    if (!navigator.onLine) {
      console.log('📱 Offline mode: using compressed Base64 Data URL');
      return compressedDataUrl;
    }

    // 2. Prepare FormData for Cloudinary API upload
    const formData = new FormData();
    formData.append('file', compressedDataUrl);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    // 3. Upload to Cloudinary CDN (Cloud Name: n90bjay3)
    const response = await fetch(CLOUDINARY_CONFIG.uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      if (data.secure_url) {
        console.log('🖼️ Cloudinary CDN upload success (n90bjay3):', data.secure_url);
        return data.secure_url;
      }
    } else {
      console.warn('Cloudinary upload preset notice (falling back to Data URL):', response.statusText);
    }
  } catch (err) {
    console.warn('Cloudinary upload notice (using Data URL fallback):', err);
  }

  // 4. Fallback to compressed Data URL if Cloudinary upload preset is not enabled yet
  return await compressImage(file, maxWidth, quality);
}
