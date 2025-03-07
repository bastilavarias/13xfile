import React, { useState } from "react";
import { File, Files, Library, PlusCircle, Server } from "lucide-react";

import { cn } from "@/utils/tailwind";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import BaseLayoutNavSideBarNav from "@/layouts/base/components/sidebar-nav";
import Navbar from "@/layouts/base/components/navbar";
import DragTopWindow from "@/components/drag-top-window";
import { Button } from "@/components/ui/button";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const defaultLayout = [20, 32, 48];
  const navCollapsedSize = 4;

  return (
    <>
      <DragTopWindow title="13xFile | Share your Isolation" />
      <Navbar />
      <TooltipProvider delayDuration={0}>
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={(sizes: number[]) => {
            document.cookie = `react-resizable-panels:layout:mail=${JSON.stringify(
              sizes,
            )}`;
          }}
          className="h-full items-stretch"
        >
          <ResizablePanel
            defaultSize={defaultLayout[0]}
            collapsedSize={navCollapsedSize}
            collapsible={true}
            minSize={15}
            maxSize={20}
            onCollapse={() => {
              setIsCollapsed(true);
              document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                true,
              )}`;
            }}
            onResize={() => {
              setIsCollapsed(false);
              document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                false,
              )}`;
            }}
            className={cn(
              isCollapsed &&
                "min-w-[50px] transition-all duration-300 ease-in-out",
            )}
          >
            <div
              className={cn(
                "flex h-[52px] items-center justify-center",
                isCollapsed ? "h-[52px]" : "px-2",
              )}
            >
              <span className="text-2xl font-bold">13xFile</span>
            </div>
            <BaseLayoutNavSideBarNav
              isCollapsed={isCollapsed}
              links={[
                {
                  title: "Library",
                  label: "0",
                  icon: Library,
                  variant: "secondary",
                  href: "/",
                },
                {
                  title: "Hosted Files",
                  label: "0",
                  icon: Server,
                  variant: "ghost",
                  href: "/hosted-files",
                },
              ]}
            />
            <Separator />
            <BaseLayoutNavSideBarNav
              isCollapsed={isCollapsed}
              links={[
                {
                  title: "Login",
                  variant: "secondary",
                  href: "/login",
                },
                {
                  title: "Register",
                  variant: "ghost",
                  href: "/register",
                },
              ]}
            />
            {/*<BaseLayoutNavSideBarNav*/}
            {/*  isCollapsed={isCollapsed}*/}
            {/*  links={[*/}
            {/*    {*/}
            {/*      title: "Recent Files",*/}
            {/*      label: "",*/}
            {/*      icon: Files,*/}
            {/*      variant: "ghost",*/}
            {/*    },*/}
            {/*    {*/}
            {/*      title: "thesisv2.pdf",*/}
            {/*      label: "",*/}
            {/*      icon: File,*/}
            {/*      variant: "ghost",*/}
            {/*    },*/}
            {/*  ]}*/}
            {/*/>*/}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
            <main className="h-screen overflow-y-auto pb-20">{children}</main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </TooltipProvider>
    </>
  );
}
