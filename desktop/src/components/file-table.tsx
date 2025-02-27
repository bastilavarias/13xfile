import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileTextIcon, FileVideo, ImageIcon, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import React from "react";

export default function FileTable() {
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
        <TableRow>
          <TableCell>
            <div className="flex items-center">
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-md bg-red-100">
                <ImageIcon className="h-5 w-5 text-red-500" />
              </div>
              <p className="truncate">good-memories.png</p>
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground">17 Aug 2023</TableCell>
          <TableCell className="text-muted-foreground">2 Month ago</TableCell>
          <TableCell className="text-muted-foreground">15.7 MB</TableCell>
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
      </TableBody>
    </Table>
  );
}
