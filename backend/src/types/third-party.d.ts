declare module 'papaparse' {
  export interface ParseError {
    type?: string
    code?: string
    message: string
    row?: number
  }

  export interface ParseResult<T> {
    data: T[]
    errors: ParseError[]
  }

  export interface ParseConfig<T> {
    header?: boolean
    skipEmptyLines?: boolean
    transformHeader?: (header: string) => string
    complete?: (results: ParseResult<T>) => void
    error?: (err: unknown) => void
  }

  export function parse<T = unknown>(input: string, config?: ParseConfig<T>): ParseResult<T>
  export function unparse<T = unknown>(data: T[] | Record<string, unknown>[]): string

  const Papa: {
    parse: typeof parse
    unparse: typeof unparse
  }

  export default Papa
}

declare module 'multer' {
  import type { RequestHandler } from 'express'

  export interface StorageEngine {}

  export interface Multer {
    single(fieldName: string): RequestHandler
    array(fieldName: string, maxCount?: number): RequestHandler
    fields(fields: ReadonlyArray<{ name: string; maxCount?: number }>): RequestHandler
  }

  export interface Options {
    storage?: StorageEngine
    dest?: string
  }

  function multer(options?: Options): Multer

  namespace multer {
    function memoryStorage(): StorageEngine
  }

  export default multer
}

declare module 'bwip-js' {
  const bwipjs: {
    toBuffer(options: Record<string, unknown>): Promise<Buffer>
  }

  export default bwipjs
}

declare module 'pdfmake' {
  export default class PdfPrinter {
    constructor(fonts: Record<string, unknown>)
    createPdfKitDocument(docDefinition: Record<string, unknown>): {
      pipe(stream: NodeJS.WritableStream): void
      on(event: string, listener: (...args: any[]) => void): void
      end(): void
    }
  }
}

declare module 'pdfmake/interfaces' {
  export type TableCell = unknown
  export type Content = unknown
  export type TDocumentDefinitions = Record<string, unknown>
}
