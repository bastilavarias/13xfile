import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileTextIcon,
  FileVideo,
  ImageIcon,
  MoreVertical,
  File,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import React from "react";

// Define the type for a file
interface File {
  name: string;
  type: "image" | "pdf" | "document" | "code" | "video";
  size: string;
  visibility: string;
}

// Define the props for the FileTable component
interface FileTableProps {
  files: File[];
}

export default function FileTable({ files }: FileTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="text-xs font-medium">File Name</TableHead>
          <TableHead className="text-xs font-medium">Date Upload</TableHead>
          <TableHead className="text-xs font-medium">Last Update</TableHead>
          <TableHead className="text-xs font-medium">File Size</TableHead>
          <TableHead className="w-[50px] text-xs font-medium"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file, index) => (
          <TableRow key={index}>
            <TableCell>
              <div className="flex items-center">
                <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-md bg-red-100">
                  {file.type === "image" ? (
                    <ImageIcon className="h-5 w-5 text-red-500" />
                  ) : file.type === "pdf" ? (
                    <FileTextIcon className="h-5 w-5 text-blue-500" />
                  ) : file.type === "document" ? (
                    <FileTextIcon className="h-5 w-5 text-green-500" />
                  ) : file.type === "code" ? (
                    <File className="h-5 w-5 text-purple-500" />
                  ) : file.type === "video" ? (
                    <FileVideo className="h-5 w-5 text-orange-500" />
                  ) : null}
                </div>
                <p className="truncate">{file.name}</p>
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
