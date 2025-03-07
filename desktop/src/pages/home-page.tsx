import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BaseLayout from "@/layouts/base/layout";
import { Library, Heart, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import FileCard from "@/components/file-card";
import FileTable from "@/components/file-table";
import CustomToolbar from "@/components/custom-toolbar";
import { CARD_VIEW_MODE, SORT_DESC } from "@/constants";

export default function HomePage() {
  const [viewMode, setViewMode] = useState(CARD_VIEW_MODE);
  const [sort, setSort] = useState(SORT_DESC);

  const files = [
    { name: "good-memories.png", type: "image" as const, size: "15.7 MB" },
    { name: "data-webtech.pdf", type: "pdf" as const, size: "175 MB" },
    { name: "live-report.docx", type: "document" as const, size: "34.7 MB" },
    { name: "valorant.apk", type: "code" as const, size: "105.7 MB" },
    { name: "old-memories.mov", type: "video" as const, size: "505.7 MB" },
    { name: "good-girl.jpeg", type: "image" as const, size: "100.8 MB" },
    { name: "football-game.apk", type: "code" as const, size: "205.9 MB" },
    { name: "summer-vacation.jpg", type: "image" as const, size: "12.3 MB" },
    { name: "project-plan.pdf", type: "pdf" as const, size: "2.1 MB" },
    { name: "meeting-notes.docx", type: "document" as const, size: "0.5 MB" },
    { name: "music-playlist.mp3", type: "audio" as const, size: "320 MB" },
    { name: "trailer.mp4", type: "video" as const, size: "1.2 GB" },
    { name: "source-code.zip", type: "code" as const, size: "45.6 MB" },
    { name: "profile-picture.png", type: "image" as const, size: "3.4 MB" },
    { name: "financial-report.pdf", type: "pdf" as const, size: "8.9 MB" },
    { name: "resume.docx", type: "document" as const, size: "0.2 MB" },
    { name: "podcast-episode.mp3", type: "audio" as const, size: "45 MB" },
    { name: "wedding-video.mov", type: "video" as const, size: "2.5 GB" },
    { name: "game-installer.exe", type: "code" as const, size: "1.8 GB" },
    { name: "landscape-photo.jpg", type: "image" as const, size: "7.6 MB" },
  ];

  return (
    <BaseLayout>
      <div className="space-y-4 p-8 pt-6">
        <div className="flex items-start justify-between">
          <h2 className="flex items-center gap-1 text-3xl font-semibold tracking-tight">
            <Library strokeWidth={2.5} />
            Library
          </h2>
          <Tabs defaultValue="public" className="space-y-4">
            <TabsList>
              <TabsTrigger value="public">Public</TabsTrigger>
              <TabsTrigger value="shared">
                <Users />
                Shared with me
              </TabsTrigger>
              <TabsTrigger value="favorites">
                <Heart />
                Favorites
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <section className="space-y-3">
          <CustomToolbar
            viewMode={viewMode}
            setViewMode={setViewMode}
            sort={sort}
            setSort={setSort}
          />
          <div className="space-y-3">
            <p className="text-sm font-semibold">From the Community</p>

            {viewMode === CARD_VIEW_MODE ? (
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {files.map((file, index) => (
                  <FileCard
                    key={index}
                    name={file.name}
                    type={file.type}
                    size={file.size}
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
