import React from "react";
import { cn } from "@/utils/tailwind";
import { Button } from "@/components/ui/button";
import { Library, Server } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <div className={cn("pb-12 h-screen", className)}>
      <div>
        <div className="flex justify-center items-center py-4">
          <h1 className="font-bold text-2xl">LOGO</h1>
        </div>
        <Separator />
        <div className="px-3 space-y-8 py-4">
          <div className="space-y-3">
            <div className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Overview
            </div>
            <div className="space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Library />
                  Library
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Server />
                  Hosted Files
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
