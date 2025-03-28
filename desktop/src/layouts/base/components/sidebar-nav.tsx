import React from "react";
import { LucideIcon } from "lucide-react";

import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/utils/tailwind";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavProps {
  isCollapsed: boolean;
  links: {
    title: string;
    label?: string;
    icon?: LucideIcon;
    variant: "default" | "ghost" | "secondary";
    href: string;
  }[];
}

export default function BaseLayoutNavSideBarNav({
  links,
  isCollapsed,
}: NavProps) {
  const location = useLocation();

  return (
    <div
      data-collapsed={isCollapsed}
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link, index) => {
          const isActive = location.pathname === link.href;

          return isCollapsed ? (
            <Tooltip key={index} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={link.href}
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "default" : "ghost",
                      size: "icon",
                    }),
                    "h-9 w-9",
                    isActive &&
                      "dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white",
                  )}
                >
                  {link.icon && <link.icon className="mr-2 h-4 w-4" />}
                  <span className="sr-only">{link.title}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-4">
                {link.title}
                {link.label && (
                  <span className="text-muted-foreground ml-auto">
                    {link.label}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              key={index}
              to={link.href}
              className={cn(
                buttonVariants({
                  variant: isActive ? "default" : "ghost",
                  size: "sm",
                }),
                isActive &&
                  "dark:bg-muted dark:hover:bg-muted dark:text-white dark:hover:text-white",
                "justify-start",
              )}
            >
              {link.icon && <link.icon className="mr-2 h-4 w-4" />}

              {link.title}
              {link.label && (
                <span
                  className={cn(
                    "ml-auto",
                    link.variant === "default" &&
                      "text-background dark:text-white",
                  )}
                >
                  {link.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
