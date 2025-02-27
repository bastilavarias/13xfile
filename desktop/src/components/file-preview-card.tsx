import React, { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Code,
  File,
  FileAudio,
  FileText,
  FileVideo,
  ImageIcon,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

interface FilePreviewCardProps {
  type: string;
  name: string;
  size: string;
}

const fileTypeColorMap = {
  image: "red",
  document: "blue",
  pdf: "green",
  code: "purple",
  video: "green",
  audio: "green",
  default: "gray",
} as const;

export default function FilePreviewCard({
  type = "default",
  name,
  size,
}: FilePreviewCardProps) {
  const color = fileTypeColorMap[type];

  return (
    <Card>
      <CardContent className="px-3">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md",
              `bg-${color}-100`,
            )}
          >
            <FileIcon type={type} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Open</DropdownMenuItem>
              <DropdownMenuItem>Download</DropdownMenuItem>
              <DropdownMenuItem>Share</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h3 className="mt-3 truncate text-sm font-medium">{name}</h3>
        <p className="text-muted-foreground truncate text-xs">
          {size} | Nov 12 2023
        </p>
      </CardContent>
    </Card>
  );
}

type FileType = keyof typeof fileTypeColorMap;

interface FileIconProps {
  type: FileType;
}
const FileIcon: React.FC<FileIconProps> = ({ type }) => {
  // Get the color based on the file type
  const color = fileTypeColorMap[type] || fileTypeColorMap.default;
  const iconProps = { className: `h-5 w-5 text-${color}-500` };

  switch (type) {
    case "image":
      return <ImageIcon {...iconProps} />;
    case "document":
      return <FileText {...iconProps} />;
    case "pdf":
      return <File {...iconProps} />;
    case "code":
      return <Code {...iconProps} />;
    case "audio":
      return <FileAudio {...iconProps} />;
    case "video":
      return <FileVideo {...iconProps} />;
    default:
      return <File {...iconProps} />; // Default icon for unknown file types
  }
};
