import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CoreFile } from "@/types/core";
import { cn } from "@/utils/tailwind";
import { getFileTypeIcon } from "@/helpers/file-helpers";
import { FileTypeIcon } from "@/types/color";

// Define the props for the FileTable component

interface CoreFileIcon extends CoreFile {
  icon: FileTypeIcon;
}
interface FileTableProps {
  files: CoreFileIcon[];
}

export default function FileTable({ files }: FileTableProps) {
  let [theFiles] = useState(files);
  theFiles = theFiles.map((file) => ({
    ...file,
    icon: getFileTypeIcon(file.type),
  }));
  console.log(theFiles);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs font-medium">File Name</TableHead>
          <TableHead className="text-xs font-medium">Date Upload</TableHead>
          <TableHead className="text-xs font-medium">Last Update</TableHead>
          <TableHead className="text-xs font-medium">File Size</TableHead>
          <TableHead className="w-[50px] text-xs font-medium"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {theFiles.map((file, index) => (
          <TableRow key={index}>
            <TableCell>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: file.icon.bgColor,
                  }}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md",
                    `bg-[${file.icon.bgColor}]`,
                  )}
                >
                  <file.icon.icon className="h-5 w-5" color={file.icon.color} />
                </div>
                <p className="truncate font-medium">{file.name}</p>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">17 Aug 2023</TableCell>
            <TableCell className="text-muted-foreground">
              2 months ago
            </TableCell>
            <TableCell className="text-muted-foreground">{file.size}</TableCell>
            <TableCell>
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
