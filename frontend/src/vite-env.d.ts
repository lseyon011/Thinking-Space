/// <reference types="vite/client" />

// File System Access API types (Chromium-only, not in lib.dom yet)
interface FileSystemDirectoryHandle {
  kind: 'directory'
  name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface FileSystemFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>
  close(): Promise<void>
}

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}
