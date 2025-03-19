import React, { useEffect, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  FileSearch,
  Globe2,
  Heart,
  Loader2,
  Share,
  Share2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import { Badge } from "@/components/ui/badge";
import { getFileTypeCategoryIcon } from "@/utils/icon";
import { CoreFile } from "@/types/core";
import AppTooltip from "@/components/app-tooltip";
import { toast } from "sonner";

export default function FileCard({
  category = "default",
  cid,
  name,
  slug,
  size,
  visibility,
}: CoreFile) {
  const categoryIcon = getFileTypeCategoryIcon(category);
  const [checking, setChecking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const checkFileAvailability = async () => {
      setChecking(true);
      const availability = await window.file.checkStatus(cid);
      setIsOnline(availability);
      setChecking(false);
    };

    checkFileAvailability();
  }, [cid]);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"; // Convert to GB
    } else if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB"; // Convert to MB
    } else if (bytes >= 1024) {
      return (bytes / 1024).toFixed(2) + " KB"; // Convert to KB
    } else {
      return bytes + " B"; // Show in Bytes if < 1KB
    }
  };

  const onShareButtonClick = () => {
    toast("File URL copied to clipboard.");
  };

  const onDownload = async () => {
    try {
      console.log("downloading");
    } catch (e) {
      console.log("Download error:");
      console.log(e);
    }
  };

  const onOpenWeb = async () => {
    window.file.openExternal(`${window.envVariable.webBaseUrl}/file/${slug}`);
  };

  return (
    <Card>
      <CardContent className="px-3">
        <div className="flex items-start justify-between">
          <div
            style={{
              backgroundColor: categoryIcon.bgColor,
            }}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md",
              `bg-[${categoryIcon.bgColor}]`,
            )}
          >
            <categoryIcon.icon className="h-5 w-5" color={categoryIcon.color} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Share2 size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenWeb}>
                Open in Web <Globe2 className="text-primary" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownload}>Download</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div>
          <h3 className="mt-3 truncate text-sm font-medium">{name}</h3>
          <p className="text-muted-foreground truncate text-xs">
            {formatFileSize(size)} | Nov 12 2023
          </p>
        </div>
        {visibility && (
          <Badge variant="outline" className="mt-3 capitalize">
            {visibility}
          </Badge>
        )}
      </CardContent>
      <CardFooter className="px-3">
        <div className="flex-1">
          {checking ? (
            <small className="text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking
            </small>
          ) : (
            <Badge variant="secondary">
              <span
                className={`h-3 w-3 rounded-full ${
                  isOnline ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
              {isOnline ? "Online" : "Offline"}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-end">
          <AppTooltip label="Share">
            <Button size="icon" variant="ghost" onClick={onShareButtonClick}>
              <Share />
            </Button>
          </AppTooltip>
          <AppTooltip label="Preview">
            <Button size="icon" variant="ghost">
              <FileSearch />
            </Button>
          </AppTooltip>
          <AppTooltip label="Favorite">
            <Button size="icon" variant="ghost">
              <Heart />
            </Button>
          </AppTooltip>
        </div>
      </CardFooter>
    </Card>
  );
}
