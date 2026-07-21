import { supabase } from './supabase';

const DEFAULT_EXPIRES_IN = 600; // 10 minutes

// Stored values are legacy `getPublicUrl()` strings like
// `.../storage/v1/object/public/<bucket>/<path>`. Parsing them lets us
// re-sign access to buckets that used to be public without a data migration.
function parseStorageUrl(value) {
  if (!value) return null;
  const match = value.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/**
 * Resolves a stored document reference (legacy public URL or bare storage path)
 * into a short-lived signed URL. Returns null if the caller isn't authorized
 * to read the underlying object (storage RLS denies it) or on any failure.
 */
export async function getSignedDocumentUrl(storedValue, fallbackBucket = 'documents', expiresIn = DEFAULT_EXPIRES_IN) {
  if (!storedValue) return null;

  const parsed = parseStorageUrl(storedValue);
  const bucket = parsed?.bucket || fallbackBucket;
  const path = parsed?.path || storedValue;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.error('getSignedDocumentUrl failed:', error.message);
    return null;
  }
  return data.signedUrl;
}
