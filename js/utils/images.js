// =====================================================
// IMAGE UTILITIES
// =====================================================

import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { storage } from '../config/firebase-init.js';

/**
 * Compresses an image file for optimal web usage
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width (default: 600)
 * @param {number} quality - Image quality 0-1 (default: 0.7)
 * @returns {Promise<Blob>} Compressed image blob
 */
export function compressImage(file, maxWidth = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

/**
 * Uploads an image to Firebase Storage
 * @param {Blob|File} file - Image file or blob
 * @param {string} path - Storage path (e.g., 'avatars/userId')
 * @returns {Promise<{url: string, path: string}>} Download URL and full path
 */
export async function uploadImage(file, path) {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
        url: downloadURL,
        path: snapshot.ref.fullPath
    };
}

/**
 * Deletes an image from Firebase Storage
 * @param {string} path - Storage path to delete
 * @returns {Promise<void>}
 */
export async function deleteImage(path) {
    if (!path) return;
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
}

/**
 * Creates a preview URL from a file
 * @param {File|Blob} file - Image file
 * @returns {string} Object URL for preview
 */
export function createPreviewUrl(file) {
    return URL.createObjectURL(file);
}

/**
 * Revokes a preview URL to free memory
 * @param {string} url - Object URL to revoke
 */
export function revokePreviewUrl(url) {
    URL.revokeObjectURL(url);
}

/**
 * Validates image file type
 * @param {File} file - File to validate
 * @returns {boolean} True if valid image type
 */
export function isValidImageType(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
}

/**
 * Validates image file size
 * @param {File} file - File to validate
 * @param {number} maxSizeMB - Maximum size in MB (default: 5)
 * @returns {boolean} True if file size is valid
 */
export function isValidImageSize(file, maxSizeMB = 5) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxBytes;
}
