export type FileType =
  | "document" // PDF, DOC, DOCX, TXT, etc.
  | "video" // MP4, AVI, MKV, MOV, etc.
  | "music" // MP3, WAV, FLAC, etc.
  | "applications" // APK, EXE, DMG, etc.
  | "compressed" // ZIP, RAR, 7Z, TAR, etc.
  | "image" // JPG, PNG, GIF, SVG, etc.
  | "code" // JS, TS, PY, HTML, CSS, etc.
  | "spreadsheet" // XLS, XLSX, CSV, etc.
  | "presentation" // PPT, PPTX, KEY, etc.
  | "database" // SQL, DB, SQLITE, etc.
  | "ebook" // EPUB, MOBI, etc.
  | "executable" // SH, BAT, etc.
  | "font" // TTF, OTF, WOFF, etc.
  | "archive" // ISO, TAR.GZ, etc.
  | "disk-image" // ISO, IMG, etc.
  | "config" // JSON, YAML, XML, INI, etc.
  | "log" // LOG, TXT (log files)
  | "backup" // BAK, TMP, etc.
  | "virtual-machine" // VMDK, OVA, etc.
  | "3d-model" // OBJ, STL, FBX, etc.
  | "default"
  | string; // OBJ, STL, FBX, etc.

export interface FileTypeIcon {
  type: FileType;
  color: string;
  bgColor: string;
  icon: any;
}
