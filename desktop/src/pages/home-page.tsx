import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BaseLayout from "@/layouts/base/layout";
import {
  Files,
  FileType,
  Rows2,
  Table2,
  Search,
  Calendar,
  Upload,
  SortDesc,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import FilePreviewCard from "@/components/file-preview-card";
import FileTable from "@/components/file-table";

export default function HomePage() {
  const [viewMode, setViewMode] = useState("card");

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
            <Files />
            Library
          </h2>
          <Tabs defaultValue="public" className="space-y-4">
            <TabsList>
              <TabsTrigger value="public">Public</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <section className="space-y-20">
          <Toolbar />

          {/* Storage Cards */}
          {/*<div>*/}
          {/*  <h2 className="mb-1 text-lg font-medium">Overview Storage</h2>*/}
          {/*  <p className="text-muted-foreground mb-4 text-sm">*/}
          {/*    Document that you save on our storage*/}
          {/*  </p>*/}
          {/*</div>*/}

          {/*<div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">*/}
          {/*  <Card>*/}
          {/*    <CardHeader className="pb-2">*/}
          {/*      <div className="flex items-center">*/}
          {/*        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-red-100">*/}
          {/*          <ImageIcon className="h-4 w-4 text-red-500" />*/}
          {/*        </div>*/}
          {/*        <div>*/}
          {/*          <CardTitle className="text-sm">Image Files</CardTitle>*/}
          {/*          <p className="text-muted-foreground text-xs">1768 items</p>*/}
          {/*        </div>*/}
          {/*      </div>*/}
          {/*    </CardHeader>*/}
          {/*    <CardContent>*/}
          {/*      <Progress value={16.7} className="h-1.5" />*/}
          {/*      <p className="text-muted-foreground mt-2 text-xs">*/}
          {/*        20 GB of 120 GB*/}
          {/*      </p>*/}
          {/*    </CardContent>*/}
          {/*  </Card>*/}

          {/*  <Card>*/}
          {/*    <CardHeader className="pb-2">*/}
          {/*      <div className="flex items-center">*/}
          {/*        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-green-100">*/}
          {/*          <FileVideo className="h-4 w-4 text-green-500" />*/}
          {/*        </div>*/}
          {/*        <div>*/}
          {/*          <CardTitle className="text-sm">Video Files</CardTitle>*/}
          {/*          <p className="text-muted-foreground text-xs">223 items</p>*/}
          {/*        </div>*/}
          {/*      </div>*/}
          {/*    </CardHeader>*/}
          {/*    <CardContent>*/}
          {/*      <Progress value={8.3} className="h-1.5" />*/}
          {/*      <p className="text-muted-foreground mt-2 text-xs">*/}
          {/*        10 GB of 120 GB*/}
          {/*      </p>*/}
          {/*    </CardContent>*/}
          {/*  </Card>*/}

          {/*  <Card>*/}
          {/*    <CardHeader className="pb-2">*/}
          {/*      <div className="flex items-center">*/}
          {/*        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-amber-100">*/}
          {/*          <FileTextIcon className="h-4 w-4 text-amber-500" />*/}
          {/*        </div>*/}
          {/*        <div>*/}
          {/*          <CardTitle className="text-sm">Document Files</CardTitle>*/}
          {/*          <p className="text-muted-foreground text-xs">1522 items</p>*/}
          {/*        </div>*/}
          {/*      </div>*/}
          {/*    </CardHeader>*/}
          {/*    <CardContent>*/}
          {/*      <Progress value={12.5} className="h-1.5" />*/}
          {/*      <p className="text-muted-foreground mt-2 text-xs">*/}
          {/*        15 GB of 120 GB*/}
          {/*      </p>*/}
          {/*    </CardContent>*/}
          {/*  </Card>*/}
          {/*</div>*/}

          {/* Overview Section */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">From the Community</p>

            {viewMode === "card" ? (
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {files.map((file, index) => (
                  <FilePreviewCard
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
                  <FileTable />
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </BaseLayout>
  );
}

function Toolbar() {
  return (
    <>
      <Card className="mb-4 overflow-hidden py-0 shadow-none">
        <div className="bg-secondary border-b p-3">
          <p className="text-primary text-sm">
            Lorem ipsum dolor sit amet, consectetur adipisicing elit.
          </p>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Input
              className="flex-1 border-0 px-0 py-0 shadow-none focus-visible:ring-0"
              placeholder="Search file..."
            />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Button>
              <div className="flex items-center gap-2 border-l pl-2">
                <Button variant="default" size="sm" className="gap-1">
                  <Upload className="h-4 w-4" />
                  <span>Share File</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <FileType />
            File Type
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar />
            Posted
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Table2 />
          </Button>
          <Button variant="outline" size="icon">
            <Rows2 />
          </Button>
          <Button variant="outline" size="icon">
            <SortDesc />
          </Button>
        </div>
      </div>
    </>
  );
}
