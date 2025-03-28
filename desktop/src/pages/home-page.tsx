import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BaseLayout from "@/layouts/base/layout";
import { Library, Heart, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import FileCard from "@/components/file-card";
import FileTable from "@/components/file-table";
import CustomToolbar from "@/components/custom-toolbar";
import { CARD_VIEW_MODE, SORT_DESC } from "@/constants";
import { CoreFile, FileRepositoryState } from "@/types/core";

export default function HomePage() {
  const [viewMode, setViewMode] = useState(CARD_VIEW_MODE);
  const [sort, setSort] = useState(SORT_DESC);
  const [files, setFiles] = useState<CoreFile[]>([]);

  useEffect(() => {
    window.file.onStateUpdate((state: FileRepositoryState) => {
      setFiles(state.files);
    });

    const getFiles = async () => {
      const list = await window.file.list();
      setFiles(list);
    };

    getFiles();
  }, []);

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
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {files.map((file, index) => (
                  <FileCard
                    key={index}
                    cid={file.cid}
                    name={file.name}
                    slug={file.slug}
                    category={file.category}
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
