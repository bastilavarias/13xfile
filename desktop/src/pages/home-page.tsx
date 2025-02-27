import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BaseLayout from "@/layouts/base/layout";
import { Files } from "lucide-react";

export default function HomePage() {
  return (
    <BaseLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
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

            <TabsContent value="public"></TabsContent>
          </Tabs>
        </div>
      </div>
    </BaseLayout>
  );
}
