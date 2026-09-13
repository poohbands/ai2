/**
 * OCR module - Phase 2
 * - Images: Tesseract.js (eng+tha) fully offline-capable
 * - Scanned PDFs: heuristic detection + pluggable OCR (Mistral OCR API if key set, else guidance)
 */

export interface OcrResult {
  text: string
  method: 'tesseract' | 'mistral' | 'none'
  confidence?: number
  isScanned?: boolean
}

export function isScannedPdfText(text: string): boolean {
  const trimmed = (text || '').trim()
  // Heuristic: very little extractable text = likely scanned
  if (trimmed.length < 100) return true
  // Mostly whitespace/control chars
  const alphaNum = trimmed.replace(/[^A-Za-z0-9ก-๛]/g, '')
  if (alphaNum.length < 50) return true
  return false
}

export async function ocrImageBuffer(buffer: Buffer, langs = 'eng+tha'): Promise<OcrResult> {
  const provider = process.env.OCR_PROVIDER || 'tesseract'
  if (provider === 'none') {
    return { text: '', method: 'none' }
  }

  // Tesseract.js - works on Vercel nodejs runtime
  try {
    const Tesseract = await import('tesseract.js')
    const result = await Tesseract.recognize(buffer, langs)
    return {
      text: result.data.text?.trim() || '',
      method: 'tesseract',
      confidence: result.data.confidence,
    }
  } catch (err) {
    console.error('[ocr] tesseract failed:', err instanceof Error ? err.message : err)
    return { text: '', method: 'none' }
  }
}

export async function ocrScannedPdf(
  buffer: Buffer,
  extractedText: string,
  fileName: string
): Promise<OcrResult> {
  const scanned = isScannedPdfText(extractedText)
  if (!scanned) {
    return { text: extractedText, method: 'none', isScanned: false }
  }

  // Try Mistral OCR API if configured (best quality for scanned PDFs)
  const mistralKey = process.env.MISTRAL_API_KEY
  if (mistralKey) {
    try {
      const base64 = buffer.toString('base64')
      const res = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mistralKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-ocr-latest',
          document: {
            type: 'document_url',
            document_url: `data:application/pdf;base64,${base64}`,
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const pages = data.pages || []
        const text = pages.map((p: { markdown?: string }) => p.markdown || '').join('\n\n')
        if (text.trim()) {
          return { text: text.trim(), method: 'mistral', isScanned: true }
        }
      }
    } catch (err) {
      console.error('[ocr] mistral failed:', err instanceof Error ? err.message : err)
    }
  }

  // No pdf-to-image pipeline on Vercel (would need poppler) -
  // return guidance so chat layer can use Vision LLM as fallback
  return {
    text: '',
    method: 'none',
    isScanned: true,
  }
}

export function scannedPdfGuidance(fileName: string): string {
  return `[ไฟล์ ${fileName} เป็น scanned PDF - Phase 1 extract ข้อความไม่ได้, Phase 2 ตรวจพบแล้ว]\nวิธีใช้: 1) ตั้ง MISTRAL_API_KEY เพื่อ OCR อัตโนมัติ, 2) หรือเลือกโมเดล Vision แล้วแนบภาพถ่ายของหน้าเอกสารเป็น PNG/JPG แทน, 3) หรือแปลง PDF เป็น text ด้วยเครื่องมือภายนอกแล้วอัปโหลดเป็น .txt`
}
