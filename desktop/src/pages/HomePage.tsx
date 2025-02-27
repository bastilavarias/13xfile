import React from "react";
import { Sidebar } from "@/components/template/Sidebar";
import Navbar from "@/components/template/Navbar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FileTable from "@/components/FileTable";

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <div className="border-t">
          <div className="bg-background">
            <div className="grid lg:grid-cols-5">
              <Sidebar className="hidden lg:block" />
              <div className="col-span-3 lg:col-span-4 lg:border-l">
                <div className="h-full px-4 py-6 lg:px-8">
                  <div className="flex-1 space-y-4 p-8 pt-6">
                    <h2 className="text-3xl font-bold tracking-tight">Library</h2>
                    <Tabs defaultValue="public" className="space-y-4">
                      <TabsList>
                        <TabsTrigger value="public">Public</TabsTrigger>
                        <TabsTrigger value="favorites">
                          Favorites
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="public">
                        <FileTable/>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
