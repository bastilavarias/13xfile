import React from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import Navbar from "@/components/template/Navbar";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion title="13xFile | Share your Isolation" />
      <main className="h-screen">{children}</main>
    </>
  );
}
