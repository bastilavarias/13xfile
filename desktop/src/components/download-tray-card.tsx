import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
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

interface DownloadTrayProps {
  className?: string;
}

export function DownloadTrayCard({ className }: DownloadTrayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [downloads, setDownloads] = useState<FileDownload[]>([]);

  useEffect(() => {
    window.file.onStateUpdate((state: FileRepositoryState) => {
      setDownloads(Object.assign(state.downloads));
      setIsExpanded(true);
    });
  }, []);

  return (
    <Card
      className={cn(
        "fixed right-4 bottom-0 my-0 w-full max-w-[360px] overflow-hidden rounded-none rounded-t-2xl py-0",
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
            {/*{hasCompletedItems*/}
            {/*  ? `${completedItems.length} uploads complete`*/}
            {/*  : hasInProgressItems*/}
            {/*    ? `Uploading ${inProgressItems.length} ${inProgressItems.length === 1 ? "item" : "items"}`*/}
            {/*    : "No active uploads"}*/}
            No active uploads
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full p-0"
            onClick={() => setIsExpanded(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="dark:bg-secondary p-0">
            <ul className="divide-y">
              {downloads.map((download: FileDownload) => (
                <li
                  key={download.index}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <FileIcon category={download.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{download.name}</p>
                    <div className="mt-1 h-1 w-full rounded-full bg-[#e8eaed]">
                      <div
                        className="h-1 rounded-full bg-blue-500"
                        style={{ width: `${download.progress}%` }}
                      />
                    </div>
                    {/*{item.status === "in-progress" && (*/}
                    {/*    <div className="mt-1 h-1 w-full rounded-full bg-[#e8eaed]">*/}
                    {/*      <div*/}
                    {/*          className="h-1 rounded-full bg-blue-500"*/}
                    {/*          style={{width: `${item.progress}%`}}*/}
                    {/*      />*/}
                    {/*    </div>*/}
                    {/*)}*/}
                  </div>
                  {/*<StatusIcon status={item.status} />*/}
                </li>
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
        "flex h-8 w-8 items-center justify-center rounded-md",
        `bg-[${categoryIcon.bgColor}]`,
      )}
    >
      <categoryIcon.icon className="h-4 w-4" color={categoryIcon.color} />
    </div>
  );
}

//
// function StatusIcon({ status }: { status: DownloadItem["status"] }) {
//   if (status === "complete") {
//     return (
//       <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e8e3e]">
//         <svg
//           width="12"
//           height="10"
//           viewBox="0 0 12 10"
//           fill="none"
//           xmlns="http://www.w3.org/2000/svg"
//         >
//           <path
//             d="M4.00001 7.80001L1.20001 5.00001L0.266675 5.93334L4.00001 9.66668L12 1.66668L11.0667 0.733345L4.00001 7.80001Z"
//             fill="white"
//           />
//         </svg>
//       </div>
//     );
//   }
//
//   if (status === "error") {
//     return (
//       <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d93025]">
//         <X className="h-3 w-3 text-white" />
//       </div>
//     );
//   }
//
//   return null;
// }
