import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Attachment } from '@/types'

export const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
]

export const ALLOWED_EXTENSIONS = [
  'txt',
  'csv',
  'pdf',
  'docx',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'webp',
]

export const MAX_FILE_SIZE = (Number(process.env.MAX_UPLOAD_SIZE_MB) || 10) * 1024 * 1024

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${process.env.MAX_UPLOAD_SIZE_MB || 10}MB limit`,
    }
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type',
    }
  }

  return { valid: true }
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200)
}

export async function uploadFile(
  userId: string,
  conversationId: string,
  file: File
): Promise<{ path: string; attachment: Attachment }> {
  const supabase = createServiceClient()
  const sanitizedName = sanitizeFileName(file.name)
  const fileExt = sanitizedName.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${fileExt}`
  const path = `${userId}/${conversationId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('chat-files')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const attachment: Attachment = {
    id: crypto.randomUUID(),
    user_id: userId,
    conversation_id: conversationId,
    file_name: sanitizedName,
    file_type: file.type,
    file_size: file.size,
    storage_path: path,
    created_at: new Date().toISOString(),
  }

  const { error: dbError } = await supabase.from('attachments').insert(attachment)
  if (dbError) {
    await supabase.storage.from('chat-files').remove([path])
    throw new Error(`Failed to save attachment: ${dbError.message}`)
  }

  return { path, attachment }
}

export async function getFileUrl(path: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase.storage.from('chat-files').createSignedUrl(path, 3600)
  if (!data?.signedUrl) {
    throw new Error('Failed to create signed URL')
  }
  return data.signedUrl
}

export async function deleteFile(path: string) {
  const supabase = createServiceClient()
  await supabase.storage.from('chat-files').remove([path])
  await supabase.from('attachments').delete().eq('storage_path', path)
}

export function isVisionFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isTextFile(file: File): boolean {
  return (
    file.type === 'text/plain' ||
    file.type === 'text/csv' ||
    file.type === 'application/pdf' ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}