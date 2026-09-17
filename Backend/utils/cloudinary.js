import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

// Configure Cloudinary: cloud_name is public, keys are from environment
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'oo8ob8fc';
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'msbillings_pos';

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Returns true if Cloudinary admin credentials (with api_secret) are available.
 */
export const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * Sanitize strings for use as Cloudinary public_ids / folder names.
 */
export const sanitizeId = (str) => {
  if (!str) return 'asset_' + Date.now();
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
};

/**
 * Upload an image (base64, buffer, or remote URL) to Cloudinary.
 * Works seamlessly on Cloud (signed) and Desktop .exe/.dmg (unsigned preset).
 *
 * @param {string} imageSource - Base64 data URI (data:image/...), file path, or remote URL
 * @param {object} options
 * @param {string} [options.folder='msbillings'] - Cloudinary folder path (e.g. 'msbillings/client_virajcafe_db/menus')
 * @param {string} [options.publicId] - Desired public ID for the asset
 * @param {number} [options.maxWidth=1000] - Auto-scale width to prevent oversized assets
 * @returns {Promise<{ url: string, publicId: string, format: string, isNew: boolean }>}
 */
export const uploadImage = async (imageSource, options = {}) => {
  if (!imageSource || typeof imageSource !== 'string') {
    return { url: '', publicId: '', isNew: false };
  }

  const trimmed = imageSource.trim();

  // If already a Cloudinary URL, do not re-upload
  if (trimmed.includes('cloudinary.com') || trimmed.includes('res.cloudinary.com')) {
    return { url: trimmed, publicId: '', isNew: false };
  }

  // If it is already a public HTTP/HTTPS URL and not a base64 string, keep as-is or upload
  const isBase64 = trimmed.startsWith('data:image/');
  const isRemoteUrl = /^https?:\/\//i.test(trimmed);

  if (!isBase64 && !isRemoteUrl) {
    return { url: trimmed, publicId: '', isNew: false };
  }

  const folder = options.folder || 'msbillings';
  const uploadOptions = {
    folder: folder,
    resource_type: 'image'
  };

  if (options.publicId) {
    uploadOptions.public_id = sanitizeId(options.publicId);
  }

  if (options.maxWidth) {
    uploadOptions.transformation = [
      { width: options.maxWidth, crop: 'limit' }
    ];
  }

  try {
    let result;
    if (isCloudinaryConfigured()) {
      // Signed upload for server environments with API secret
      result = await cloudinary.uploader.upload(trimmed, {
        ...uploadOptions,
        fetch_format: 'auto',
        quality: 'auto',
        overwrite: true
      });
    } else {
      // Unsigned upload for Desktop .exe/.dmg and client apps (zero secret needed!)
      result = await cloudinary.uploader.unsigned_upload(trimmed, UPLOAD_PRESET, uploadOptions);
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      isNew: true
    };
  } catch (error) {
    console.warn('[Cloudinary] Upload failed, preserving image source:', error.message);
    return { url: trimmed, publicId: '', isNew: false };
  }
};

/**
 * Upload a raw file (such as an Excel or PDF file) to Cloudinary.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {object} options
 * @param {string} [options.folder='msbillings/files']
 * @param {string} [options.publicId]
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export const uploadRawFile = async (filePath, options = {}) => {
  if (!isCloudinaryConfigured()) {
    console.warn('[Cloudinary] Cloudinary credentials not set in environment. Skipping raw file upload.');
    return { url: '', publicId: '' };
  }

  const folder = options.folder || 'msbillings/files';
  const uploadOptions = {
    folder,
    resource_type: 'raw',
    overwrite: true
  };

  if (options.publicId) {
    uploadOptions.public_id = sanitizeId(options.publicId);
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error('[Cloudinary] Raw file upload failed:', error.message);
    throw error;
  }
};

/**
 * Delete an asset from Cloudinary by public ID.
 */
export const deleteImage = async (publicId) => {
  if (!publicId) return;
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[Cloudinary] Could not delete image:', err.message);
  }
};

/**
 * Test connectivity with Cloudinary API.
 */
export const pingCloudinary = async () => {
  try {
    const res = await cloudinary.api.ping();
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

export default {
  uploadImage,
  uploadRawFile,
  deleteImage,
  pingCloudinary,
  isCloudinaryConfigured
};
