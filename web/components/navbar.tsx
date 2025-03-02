"use client";

import Link from "next/link";
import { Computer } from "lucide-react";
import ThemeToggle from "./theme-toggle";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0 flex items-center gap-3">
            <Link href="/" className="text-2xl font-bold tracking-tighter">
              13xFile
            </Link>
          </div>

          <div className="hidden md:flex space-x-8"></div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="default">
              Download <Computer />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
