import { FileTypeCategoryIcon } from "@/types/color";
import {
  FileText,
  Video,
  Music,
  Package,
  Archive,
  Image,
  Code,
  Table,
  Presentation,
  Database,
  BookOpen,
  Terminal,
  HardDrive,
  Disc,
  Settings,
  FileSearch,
  Save,
  Cpu,
  Box,
  File,
  CaseLower,
  Ban,
} from "lucide-react";

export const CARD_VIEW_MODE = "card-view-mode";
export const TABLE_VIEW_MODE = "table-view-mode";
export const SORT_DESC = "sort-desc";
export const SORT_ASC = "sort-asc";

export const FILE_TYPE_CATEGORY_ICONS: FileTypeCategoryIcon[] = [
  {
    type: "document",
    color: "#3b82f6", // Blue
    bgColor: "#dbeafe",
    icon: FileText,
  },
  {
    type: "video",
    color: "#ef4444", // Red
    bgColor: "#fee2e2",
    icon: Video,
  },
  {
    type: "audio",
    color: "#22c55e", // Green
    bgColor: "#dcfce7",
    icon: Music, // New category added
  },
  {
    type: "image",
    color: "#8b5cf6", // Purple
    bgColor: "#ede9fe",
    icon: Image,
  },
  {
    type: "archive",
    color: "#6b7280", // Gray
    bgColor: "#f3f4f6",
    icon: Archive, // Merged compressed & archive
  },
  {
    type: "executable",
    color: "#f43f5e", // Rose
    bgColor: "#ffe4e6",
    icon: Terminal,
  },
  {
    type: "script",
    color: "#f97316", // Orange
    bgColor: "#ffedd5",
    icon: Code, // New category added for scripts
  },
  {
    type: "spreadsheet",
    color: "#10b981", // Emerald
    bgColor: "#d1fae5",
    icon: Table,
  },
  {
    type: "presentation",
    color: "#ec4899", // Pink
    bgColor: "#fce7f3",
    icon: Presentation,
  },
  {
    type: "database",
    color: "#14b8a6", // Teal
    bgColor: "#ccfbf1",
    icon: Database,
  },
  {
    type: "ebook",
    color: "#a855f7", // Deep Purple
    bgColor: "#f3e8ff",
    icon: BookOpen,
  },
  {
    type: "config",
    color: "#fbbf24",
    bgColor: "#fef3c7",
    icon: Settings,
  },
  {
    type: "log",
    color: "#57534e",
    bgColor: "#f5f5f4",
    icon: FileSearch,
  },
  {
    type: "backup",
    color: "#9ca3af",
    bgColor: "#f3f4f6",
    icon: Save,
  },
  {
    type: "virtual-machine",
    color: "#7c3aed",
    bgColor: "#e0e7ff",
    icon: Cpu,
  },
  {
    type: "3d-model",
    color: "#f472b6",
    bgColor: "#fce7f3",
    icon: Box,
  },
  {
    type: "default",
    color: "#000000",
    bgColor: "#f3f4f6",
    icon: Ban,
  },
  {
    type: "unknown",
    color: "#000000",
    bgColor: "#f3f4f6",
    icon: Ban,
  },
];
