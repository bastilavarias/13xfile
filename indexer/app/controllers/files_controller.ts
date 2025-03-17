import type { HttpContext } from "@adonisjs/core/http";
import File from "#models/file";
import { customAlphabet } from "nanoid";
import slugify from "slugify";

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  10,
);

type MimeGroups = {
  [key: string]: string[];
};

const MIME_GROUPS: MimeGroups = {
  audio: [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
    "audio/aac",
    "audio/mp3",
    "audio/midi",
    "audio/x-midi",
    "audio/x-wav",
    "audio/x-aiff",
    "audio/x-mpegurl",
    "audio/x-ms-wma",
    "audio/x-pn-realaudio",
  ],
  video: [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/x-msvideo",
    "video/quicktime",
    "video/x-matroska",
    "video/mpeg",
    "video/3gpp",
    "video/3gpp2",
    "video/x-flv",
    "video/x-ms-wmv",
    "video/x-ms-asf",
    "video/x-m4v",
    "video/h264",
    "video/h265",
    "video/x-ogm",
    "video/x-mjpg",
  ],
  image: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/svg+xml",
    "image/webp",
    "image/bmp",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/tiff",
    "image/tif",
    "image/heif",
    "image/heic",
    "image/jp2",
    "image/jpx",
    "image/jpm",
    "image/x-citrix-jpeg",
    "image/x-citrix-png",
    "image/x-portable-bitmap",
    "image/x-portable-graymap",
    "image/x-portable-pixmap",
    "image/x-portable-anymap",
    "image/x-rgb",
    "image/x-xbitmap",
    "image/x-xpixmap",
    "image/x-xwindowdump",
    "image/vnd.adobe.photoshop",
    "image/vnd.dece.graphic",
    "image/vnd.djvu",
    "image/vnd.dwg",
    "image/vnd.dxf",
    "image/vnd.fastbidsheet",
    "image/vnd.fpx",
    "image/vnd.fst",
    "image/vnd.fujixerox.edmics-mmr",
    "image/vnd.fujixerox.edmics-rlc",
    "image/vnd.ms-modi",
    "image/vnd.ms-photo",
    "image/vnd.net-fpx",
    "image/vnd.wap.wbmp",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
    "application/x-latex",
    "text/plain",
    "text/csv",
    "application/json",
    "text/markdown",
    "application/x-tex",
    "text/richtext",
    "application/x-dvi",
  ],
  archive: [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-tar",
    "application/x-7z-compressed",
    "application/gzip",
    "application/x-bzip",
    "application/x-bzip2",
    "application/x-xz",
    "application/x-lzip",
    "application/x-lzma",
    "application/x-compress",
    "application/x-gtar",
    "application/x-cpio",
    "application/x-arj",
    "application/x-ms-shortcut",
    "application/x-iso9660-image",
    "application/x-shar",
    "application/vnd.android.package-archive",
  ],
  executable: [
    "application/x-msdownload",
    "application/x-msi",
    "application/x-sh",
    "application/java-archive",
    "application/vnd.microsoft.portable-executable",
    "application/x-dosexec",
    "application/x-executable",
    "application/x-mach-binary",
    "application/x-msdos-program",
    "application/x-ms-shortcut",
    "application/vnd.apple.installer+xml",
  ],
  script: [
    "application/javascript",
    "application/ecmascript",
    "application/typescript",
    "text/x-python",
    "text/x-c",
    "text/x-csrc",
    "text/x-c++",
    "text/x-c++src",
    "text/x-java-source",
    "text/x-php",
    "text/x-perl",
    "text/x-ruby",
    "text/x-shellscript",
    "application/x-lua",
    "text/x-go",
  ],
};

// Extension mapping for cases where MIME type is missing
const EXTENSION_GROUPS: { [key: string]: string } = {
  zip: "archive",
  rar: "archive",
  tar: "archive",
  "7z": "archive",
  gz: "archive",
  exe: "executable",
  msi: "executable",
  sh: "executable",
  jar: "executable",
  js: "script",
  ts: "script",
  py: "script",
  c: "script",
  go: "script",
};

const getFileCategory = (mimeType: string, extension: string): string => {
  mimeType = mimeType.toLowerCase();
  extension = extension.toLowerCase();
  for (const [category, types] of Object.entries(MIME_GROUPS)) {
    if (mimeType.split("/").length === 2) {
      if (types.includes(mimeType)) {
        return category;
      }
    } else {
      const filteredTypes = types.map((type) => type.split("/")[1]);
      if (filteredTypes.includes(mimeType)) {
        return category;
      }
    }
  }

  if (extension && EXTENSION_GROUPS[extension]) {
    return EXTENSION_GROUPS[extension];
  }

  return "unknown";
};

const createSlug = (filename: string) => {
  const uniqueId = nanoid();
  const slug = slugify.default(filename, { lower: true, strict: true });
  return `${slug}-${uniqueId}`;
};

export default class FilesController {
  async create({ request, response }: HttpContext) {
    try {
      const { cid, metadata, category } = request.all();
      const slug = createSlug(metadata.name);
      const file = await File.create({
        cid,
        name: metadata.name,
        slug,
        size: metadata.size,
        extension: metadata.extension,
        type: metadata.type,
        category,
      });

      response.send({
        data: file,
      });
    } catch (e) {
      response.send({
        data: null,
      });
    }
  }

  async index() {
    return {
      data: await File.all(),
    };
  }

  async getCategory({ request, response }: HttpContext) {
    try {
      const category = getFileCategory(
        request.input("mimetype"),
        request.input("extension"),
      );

      response.json({
        data: category,
      });
    } catch (e) {
      response.status(400).json({
        data: null,
      });
    }
  }
}
