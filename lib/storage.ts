import { supabase } from './supabase'

const BUCKET_NAME = 'user-uploads'

/**
 * Ensure storage bucket exists, create if it doesn't
 */
async function ensureBucketExists(bucketName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      // If we can't list buckets, we might not have permission, but try to upload anyway
      return { success: true }
    }

    const bucketExists = buckets?.some(b => b.name === bucketName)
    
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 10485760, // 10MB
      })

      if (createError) {
        // If bucket creation fails, it might already exist or we don't have permission
        // Log but don't fail - the upload will fail if bucket truly doesn't exist
        console.warn(`Could not create bucket ${bucketName}:`, createError.message)
      }
    }

    return { success: true }
  } catch (error) {
    // Non-fatal - try to proceed with upload
    console.warn('Error checking bucket existence:', error)
    return { success: true }
  }
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadImage(
  file: File,
  bucket: string,
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Ensure bucket exists
    await ensureBucketExists(bucket)

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      })

    if (error) {
      // Provide more helpful error messages
      if (error.message.includes('Bucket not found')) {
        return { success: false, error: `Storage bucket '${bucket}' does not exist. Please create it in Supabase dashboard.` }
      }
      throw error
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return { success: true, url: urlData.publicUrl }
  } catch (error) {
    console.error('Error uploading image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image'
    return { success: false, error: errorMessage }
  }
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  return uploadImage(file, BUCKET_NAME, filePath)
}

/**
 * Upload user banner
 */
export async function uploadBanner(
  userId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `banners/${fileName}`

  return uploadImage(file, BUCKET_NAME, filePath)
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImage(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error deleting image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete image'
    return { success: false, error: errorMessage }
  }
}

