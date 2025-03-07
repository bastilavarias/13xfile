import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import { Badge } from "@/components/ui/badge";
import { getFileTypeIcon } from "@/helpers/file-helpers";
import { CoreFile } from "@/types/core";

export default function FileCard({
  type = "default",
  name,
  size,
  visibility,
}: CoreFile) {
  const foundFileType = getFileTypeIcon(type);

  return (
    <Card>
      <CardContent className="px-3">
        <div className="flex items-start justify-between">
          <div
            style={{
              backgroundColor: foundFileType.bgColor,
            }}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md",
              `bg-[${foundFileType.bgColor}]`,
            )}
          >
            <foundFileType.icon
              className="h-5 w-5"
              color={foundFileType.color}
            />
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
        <div>
          <h3 className="mt-3 truncate text-sm font-medium">{name}</h3>
          <p className="text-muted-foreground truncate text-xs">
            {size} | Nov 12 2023
          </p>
        </div>
        {visibility && (
          <Badge variant="outline" className="mt-3 capitalize">
            {visibility}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
