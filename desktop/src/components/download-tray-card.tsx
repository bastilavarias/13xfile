import React, { useEffect, useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Trash,
  CircleX,
} from "lucide-react";
import { cn } from "@/utils/tailwind";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileDownload,
  FileRepositoryState,
  FileTypeCategory,
} from "@/types/core";
import { getFileTypeCategoryIcon } from "@/utils/icon";
import { CircularProgress } from "@/components/circular-progress";
import AppTooltip from "@/components/app-tooltip";

interface DownloadTrayProps {
  className?: string;
}

export function DownloadTrayCard({ className }: DownloadTrayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [downloads, setDownloads] = useState<FileDownload[]>([]);
  const [theme, setTheme] = useState("");

  const downloadStatus = useMemo(() => {
    return {
      count: downloads.length,
      pending: downloads.filter(
        (download) => download.status === "in-progress",
      ),
      done: downloads.filter((download) => download.status === "done"),
    };
  }, [downloads]);

  const getCurrentTheme = async () => {
    setTheme(await window.themeMode.current());
  };

  useEffect(() => {
    window.file.onStateUpdate((state: FileRepositoryState) => {
      setDownloads(state.downloads);
      setIsExpanded(true);
    });

    getCurrentTheme();
  }, []);

  return (
    <Card
      className={cn(
        "fixed right-4 bottom-0 my-0 w-full max-w-[420px] overflow-hidden rounded-none rounded-t-2xl py-0",
        className,
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="dark:bg-secondary flex flex-row items-center justify-between rounded-none border-b p-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </Button>
          </CollapsibleTrigger>

          <div className="text-sm font-medium">
            {downloadStatus.count > 0
              ? `${downloadStatus.done.length} uploads complete`
              : downloadStatus.pending.length > 0
                ? `Uploading ${downloadStatus.pending.length} ${downloadStatus.pending.length === 1 ? "item" : "items"}`
                : "No active uploads"}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full p-0"
            onClick={() => setIsExpanded(false)}
            disabled={downloadStatus.count === 0}
          >
            <Trash className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="dark:bg-secondary px-0 pb-4">
            <ul className="divide-y">
              {downloads.map((download: FileDownload) => (
                <AppTooltip label={download.progressMessage}>
                  <li
                    key={download.index}
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    {download.category && (
                      <FileIcon category={download.category} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{download.name}</p>
                    </div>

                    {download.status && (
                      <StatusIndicator
                        progress={download.progress}
                        status={download.status}
                        theme={theme}
                      />
                    )}
                  </li>
                </AppTooltip>
              ))}
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function FileIcon({ category }: { category: FileTypeCategory }) {
  const categoryIcon = getFileTypeCategoryIcon(category);
  return (
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
  );
}

function StatusIndicator({
  progress,
  status,
  theme,
}: {
  progress: number;
  status: string;
  theme: string;
}) {
  let element;
  if (status === "in-progress") {
    element = (
      <CircularProgress
        max={100}
        min={0}
        gaugePrimaryColor={theme === "light" ? "#0b0f1a" : "#f5f8fc"}
        gaugeSecondaryColor="#1a2332"
        className="size-10 text-xs"
        value={progress}
      />
    );
  } else if (status === "done") {
    element = <CircleCheck className="h-7 w-7" color="green" />;
  } else {
    element = <CircleX className="h-7 w-7" color="red" />;
  }

  return element;
}
