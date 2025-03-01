import { FileTypeIcon } from "@/types/color";
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

export const FILE_TYPES: FileTypeIcon[] = [
  {
    type: "document",
    color: "#3b82f6", // Blue
    bgColor: "#dbeafe", // Light blue
    icon: FileText,
  },
  {
    type: "video",
    color: "#ef4444", // Red
    bgColor: "#fee2e2", // Light red
    icon: Video,
  },
  {
    type: "music",
    color: "#22c55e", // Green
    bgColor: "#dcfce7", // Light green
    icon: Music,
  },
  {
    type: "applications",
    color: "#f59e0b", // Amber
    bgColor: "#fef3c7", // Light amber
    icon: Package,
  },
  {
    type: "compressed",
    color: "#6b7280", // Gray
    bgColor: "#f3f4f6", // Light gray
    icon: Archive,
  },
  {
    type: "image",
    color: "#8b5cf6", // Purple
    bgColor: "#ede9fe", // Light purple
    icon: Image,
  },
  {
    type: "code",
    color: "#f97316", // Orange
    bgColor: "#ffedd5", // Light orange
    icon: Code,
  },
  {
    type: "spreadsheet",
    color: "#10b981", // Emerald
    bgColor: "#d1fae5", // Light emerald
    icon: Table,
  },
  {
    type: "presentation",
    color: "#ec4899", // Pink
    bgColor: "#fce7f3", // Light pink
    icon: Presentation,
  },
  {
    type: "database",
    color: "#14b8a6", // Teal
    bgColor: "#ccfbf1", // Light teal
    icon: Database,
  },
  {
    type: "ebook",
    color: "#a855f7", // Deep Purple
    bgColor: "#f3e8ff", // Light deep purple
    icon: BookOpen,
  },
  {
    type: "executable",
    color: "#f43f5e", // Rose
    bgColor: "#ffe4e6", // Light rose
    icon: Terminal,
  },
  {
    type: "font",
    color: "#0ea5e9", // Sky Blue
    bgColor: "#e0f2fe", // Light sky blue
    icon: CaseLower,
  },
  {
    type: "archive",
    color: "#64748b", // Slate
    bgColor: "#f1f5f9", // Light slate
    icon: HardDrive,
  },
  {
    type: "disk-image",
    color: "#6d28d9", // Violet
    bgColor: "#ede9fe", // Light violet
    icon: Disc,
  },
  {
    type: "config",
    color: "#fbbf24", // Amber (lighter)
    bgColor: "#fef3c7", // Light amber
    icon: Settings,
  },
  {
    type: "log",
    color: "#57534e", // Warm Gray
    bgColor: "#f5f5f4", // Light warm gray
    icon: FileSearch,
  },
  {
    type: "backup",
    color: "#9ca3af", // Cool Gray
    bgColor: "#f3f4f6", // Light cool gray
    icon: Save,
  },
  {
    type: "virtual-machine",
    color: "#7c3aed", // Indigo
    bgColor: "#e0e7ff", // Light indigo
    icon: Cpu,
  },
  {
    type: "3d-model",
    color: "#f472b6", // Fuchsia
    bgColor: "#fce7f3", // Light fuchsia
    icon: Box,
  },
  {
    type: "default",
    color: "#000000",
    bgColor: "#f3f4f6",
    icon: Ban,
  },
];
