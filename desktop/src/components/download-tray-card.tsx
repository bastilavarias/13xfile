"use client";

import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  File,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/utils/tailwind";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface DownloadItem {
  id: string;
  name: string;
  type: "document" | "pdf" | "image" | "video" | "audio" | "archive" | "other";
  status: "complete" | "in-progress" | "error";
  progress?: number;
}

interface DownloadTrayProps {
  className?: string;
}

export function DownloadTrayCard({ className }: DownloadTrayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [items, setItems] = useState([]);
  const completedItems = items.filter((item) => item.status === "complete");
  const inProgressItems = items.filter((item) => item.status === "in-progress");
  const hasCompletedItems = completedItems.length > 0;
  const hasInProgressItems = inProgressItems.length > 0;

  const getDownloads = async () => {
    const downloads = await window.download.items;
    setItems(downloads);
  };

  useEffect(() => {
    getDownloads();
  }, []);

  useEffect(() => {}, [window.download.items]);

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
            {hasCompletedItems
              ? `${completedItems.length} uploads complete`
              : hasInProgressItems
                ? `Uploading ${inProgressItems.length} ${inProgressItems.length === 1 ? "item" : "items"}`
                : "No active uploads"}
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
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <FileIcon type={item.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.name}</p>
                    {item.status === "in-progress" && (
                      <div className="mt-1 h-1 w-full rounded-full bg-[#e8eaed]">
                        <div
                          className="h-1 rounded-full bg-blue-500"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <StatusIcon status={item.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function FileIcon({ type }: { type: DownloadItem["type"] }) {
  switch (type) {
    case "document":
      return <FileText className="h-5 w-5 text-[#5f6368]" />;
    case "pdf":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#ea4335] text-white">
          <FileText className="h-3.5 w-3.5" />
        </div>
      );
    case "archive":
      return <File className="h-5 w-5 text-[#5f6368]" />;
    default:
      return <File className="h-5 w-5 text-[#5f6368]" />;
  }
}

function StatusIcon({ status }: { status: DownloadItem["status"] }) {
  if (status === "complete") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e8e3e]">
        <svg
          width="12"
          height="10"
          viewBox="0 0 12 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.00001 7.80001L1.20001 5.00001L0.266675 5.93334L4.00001 9.66668L12 1.66668L11.0667 0.733345L4.00001 7.80001Z"
            fill="white"
          />
        </svg>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d93025]">
        <X className="h-3 w-3 text-white" />
      </div>
    );
  }

  return null;
}
