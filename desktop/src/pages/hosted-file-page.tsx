import React, { useState } from "react";
import BaseLayout from "@/layouts/base/layout";
import { Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import FilePreviewCard from "@/components/file-preview-card";
import FileTable from "@/components/file-table";
import CustomToolbar from "@/components/custom-toolbar";
import { CARD_VIEW_MODE, SORT_DESC } from "@/constants";

export default function HostedFilePage() {
  const [viewMode, setViewMode] = useState(CARD_VIEW_MODE);
  const [sort, setSort] = useState(SORT_DESC);

  const files = [
    {
      name: "good-memories.png",
      type: "image",
      size: "15.7 MB",
      visibility: "private",
    },
    {
      name: "data-webtech.pdf",
      type: "pdf",
      size: "175 MB",
      visibility: "public",
    },
    {
      name: "live-report.docx",
      type: "document",
      size: "34.7 MB",
      visibility: "private",
    },
    {
      name: "valorant.apk",
      type: "code",
      size: "105.7 MB",
      visibility: "public",
    },
    {
      name: "old-memories.mov",
      type: "video",
      size: "505.7 MB",
      visibility: "private",
    },
    {
      name: "good-girl.jpeg",
      type: "image",
      size: "100.8 MB",
      visibility: "public",
    },
    {
      name: "football-game.apk",
      type: "code",
      size: "205.9 MB",
      visibility: "private",
    },
    {
      name: "summer-vacation.jpg",
      type: "image",
      size: "12.3 MB",
      visibility: "public",
    },
    {
      name: "project-plan.pdf",
      type: "pdf",
      size: "2.1 MB",
      visibility: "private",
    },
    {
      name: "meeting-notes.docx",
      type: "document",
      size: "0.5 MB",
      visibility: "public",
    },
  ];

  return (
    <BaseLayout>
      <div className="space-y-4 p-8 pt-6">
        <div className="flex items-start justify-between">
          <h2 className="flex items-center gap-1 text-3xl font-semibold tracking-tight">
            <Server strokeWidth={2.5} />
            Hosted File
          </h2>
          <span>Node Status</span>
        </div>
        <section className="space-y-10">
          <CustomToolbar
            viewMode={viewMode}
            setViewMode={setViewMode}
            sort={sort}
            setSort={setSort}
          />

          {/* Overview Section */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Your Files</p>

            {viewMode === CARD_VIEW_MODE ? (
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {files.map((file, index) => (
                  <FilePreviewCard
                    key={index}
                    name={file.name}
                    type={file.type}
                    size={file.size}
                    auth={true}
                    visibility={file.visibility}
                  />
                ))}
              </div>
            ) : (
              <Card className="pt-0">
                <CardContent className="p-0">
                  <FileTable files={files} />
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </BaseLayout>
  );
}
