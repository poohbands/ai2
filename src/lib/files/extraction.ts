import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { parse } from 'csv-parse/sync'
import { ocrImageBuffer, ocrScannedPdf, scannedPdfGuidance, isScannedPdfText } from './ocr'

async function getPdfParse() {
  const pdfParse = await import('pdf-parse')
  return pdfParse as unknown as (buffer: Buffer) => Promise<{ text: string }>
}

export interface ExtractedFile {
  text: string
  isScanned?: boolean
  ocrMethod?: string
  truncated?: boolean
}

export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  const res = await extractTextWithMeta(buffer, mimeType, 'file')
  return res.text
}

export async function extractTextWithMeta(buffer: Buffer, mimeType: string, fileName = 'file'): Promise<ExtractedFile> {
  switch (mimeType) {
    case 'text/plain':
      return { text: buffer.toString('utf-8') }
    case 'text/csv':
      return { text: extractCSV(buffer) }
    case 'application/pdf':
      return extractPDF(buffer, fileName)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return { text: await extractDOCX(buffer) }
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return { text: extractXLSX(buffer) }
    case 'image/png':
    case 'image/jpeg':
    case 'image/webp': {
      const ocr = await ocrImageBuffer(buffer)
      return { text: ocr.text, ocrMethod: ocr.method }
    }
    default:
      throw new Error(`Unsupported file type for text extraction: ${mimeType}`)
  }
}

function extractCSV(buffer: Buffer): string {
  const content = buffer.toString('utf-8')
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[]
  return records.map((row) => Object.values(row).join(', ')).join('\n')
}

async function extractPDF(buffer: Buffer, fileName: string): Promise<ExtractedFile> {
  try {
    const pdfParse = await getPdfParse()
    const data = await pdfParse(buffer)
    const text = data.text || ''
    if (!isScannedPdfText(text)) {
      return { text }
    }
    // Scanned - try OCR pipeline
    const ocr = await ocrScannedPdf(buffer, text, fileName)
    if (ocr.text) {
      return { text: ocr.text, isScanned: true, ocrMethod: ocr.method }
    }
    return { text: scannedPdfGuidance(fileName), isScanned: true, ocrMethod: 'none' }
  } catch {
    throw new Error('Failed to extract text from PDF. The file may be scanned or password-protected.')
  }
}

async function extractDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch {
    throw new Error('Failed to extract text from DOCX')
  }
}

function extractXLSX(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
      return `Sheet: ${name}\n${data.map((row) => row.join(', ')).join('\n')}`
    })
    return sheets.join('\n\n')
  } catch {
    throw new Error('Failed to extract text from XLSX')
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function chunkText(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length)

    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      const lastSpace = text.lastIndexOf(' ', end)
      const breakPoint = Math.max(lastNewline, lastSpace)
      if (breakPoint > start) {
        end = breakPoint
      }
    }

    chunks.push(text.slice(start, end).trim())
    start = end
  }

  return chunks.filter((c) => c.length > 0)
}

export function truncateContext(text: string, maxTokens: number): { text: string; truncated: boolean } {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return { text, truncated: false }

  const truncatedText = text.slice(0, maxChars)
  const lastNewline = truncatedText.lastIndexOf('\n')
  const cutoff = lastNewline > maxChars * 0.5 ? lastNewline : maxChars

  return {
    text: truncatedText.slice(0, cutoff) + '\n\n[Content truncated due to length limit]',
    truncated: true,
  }
}
