"use client";

import Link from "next/link";
import { Download, AlertTriangle, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function FileDetailsSection() {
  const isOnline = true;

  const onDownload = async () => {
    try {
      const response = await fetch(
        `http://localhost:3333/api/ipfs/download/QmaXwVD8eCmABPKtGu7dC6szPxywjhuLotbdD3Qjuxasyt`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ipfs-image.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to download file. Please try again.");
    }
  };

  return (
    <section className="grid md:grid-cols-5 gap-10">
      <Card className="mb-8 overflow-hidden col-span-3">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">appmakemoney.mp4</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Uploaded 2 days ago</span>
                <Users className="h-3.5 w-3.5 ml-2" />
                <span>0 downloads</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-10">
          <div className="grid gap-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium">File Type</span>
                <span className="text-sm">MP4 Video</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Size</span>
                <span className="text-sm">33.7MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Uploaded</span>
                <span className="text-sm">2 days ago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Downloads</span>
                <span className="text-sm">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge variant="secondary">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      isOnline ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></span>
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">
                This file contains information on how to create successful apps
                that generate revenue. It includes strategies, case studies, and
                practical tips for app monetization.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full gap-2 bg-green-600 hover:bg-green-700 font-semibold dark:text-white"
              disabled={!isOnline}
              onClick={onDownload}
            >
              <Download className="h-8 w-8" strokeWidth={3} />
              DOWNLOAD NOW
            </Button>

            <Button variant="outline" className="w-full gap-2">
              Preview
            </Button>
          </div>

          <CardFooter className="justify-end items-center px-0">
            <Link
              href="/report"
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Report Issue
            </Link>
          </CardFooter>
        </CardContent>
      </Card>

      {/* Warning Card */}
      <Card className="mb-8 border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
            Download Safety
          </CardTitle>
        </CardHeader>
        <CardContent className="text-amber-800 dark:text-amber-300">
          <p className="mb-3 font-medium">
            All downloads happen in this window
          </p>
          <div className="space-y-2">
            <p className="text-sm">
              If you see any &#34;Download&#34; buttons in ads, be smart:
            </p>
            <ul className="ml-6 list-disc text-sm space-y-1">
              <li>Close that and come back here</li>
              <li>Real files are big, ads are tiny (just MBs)</li>
              <li>Our download buttons are clearly marked with our logo</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
