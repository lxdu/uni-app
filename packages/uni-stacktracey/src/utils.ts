import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  BasicSourceMapConsumer,
  IndexedSourceMapConsumer,
  SourceMapConsumer,
} from '../lib/source-map/source-map'

const splitRE = /\r?\n/

const range: number = 2

function posToNumber(
  source: string,
  pos: number | { line: number; column: number }
): number {
  if (typeof pos === 'number') return pos
  const lines = source.split(splitRE)
  const { line, column } = pos
  let start = 0
  for (let i = 0; i < line - 1; i++) {
    start += lines[i].length + 1
  }
  return start + column
}

export function generateCodeFrame(
  source: string,
  start: number | { line: number; column: number } = 0,
  end?: number
): string {
  start = posToNumber(source, start)
  end = end || start
  const lines = source.split(splitRE)
  let count = 0
  const res: string[] = []
  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + 1
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) continue
        const line = j + 1
        res.push(
          `${line}${' '.repeat(Math.max(3 - String(line).length, 0))}|  ${
            lines[j]
          }`
        )
        const lineLength = lines[j].length
        if (j === i) {
          // push underline
          const pad = start - (count - lineLength) + 1
          const length = Math.max(
            1,
            end > count ? lineLength - pad : end - start
          )
          res.push(`   |  ` + ' '.repeat(pad) + '^'.repeat(length))
        } else if (j > i) {
          if (end > count) {
            const length = Math.max(Math.min(end - count, lineLength), 1)
            res.push(`   |  ` + '^'.repeat(length))
          }
          count += lineLength + 1
        }
      }
      break
    }
  }
  return res.join('\n')
}

interface MessageSourceLocation {
  type: 'exception' | 'error' | 'warning' | 'info' | 'logging' | 'output'
  message: string
  file?: string
  line: number
  column: number
  code?: string
}
interface GenerateCodeFrameOptions {
  sourceRoot?: string
}
const isWindows = os.platform() === 'win32'
function normalizePath(id: string): string {
  return isWindows ? id.replace(/\\/g, '/') : id
}

export function generateCodeFrameSourceMapConsumer(
  consumer: BasicSourceMapConsumer | IndexedSourceMapConsumer,
  m: MessageSourceLocation,
  options: GenerateCodeFrameOptions = {}
): Required<MessageSourceLocation> | undefined {
  if (m.file) {
    const res = consumer.originalPositionFor({
      line: m.line,
      column: m.column,
    })
    if (res.source != null && res.line != null && res.column != null) {
      const code = consumer.sourceContentFor(res.source, true)
      if (code) {
        return {
          type: m.type,
          file: options.sourceRoot
            ? normalizePath(path.relative(options.sourceRoot, res.source))
            : res.source,
          line: res.line,
          column: res.column,
          message: m.message,
          code: generateCodeFrame(code, { line: res.line, column: res.column }),
        }
      }
    }
  }
}

function initConsumer(filename: string) {
  if (fs.existsSync(filename)) {
    return new SourceMapConsumer(fs.readFileSync(filename, 'utf8'))
  }
  return Promise.resolve(undefined)
}

export function generateCodeFrameWithSourceMapPath(
  filename: string,
  messages: MessageSourceLocation[] | string,
  options: GenerateCodeFrameOptions = {}
): Promise<Required<MessageSourceLocation>[]> {
  if (typeof messages === 'string') {
    try {
      messages = JSON.parse(messages)
    } catch (e) {}
  }
  if (Array.isArray(messages) && messages.length) {
    return new Promise((resolve) => {
      initConsumer(filename).then((consumer) => {
        resolve(
          (messages as MessageSourceLocation[])
            .map((m) => {
              if (m.file && consumer) {
                const message = generateCodeFrameSourceMapConsumer(
                  consumer,
                  m,
                  options
                )
                if (message) {
                  return message
                }
              }
              if (!m.file) {
                m.file = ''
              }
              return m as Required<MessageSourceLocation>
            })
            .filter(Boolean)
        )
      })
    })
  }
  return Promise.resolve([])
}
