"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Calendar, Clock, Copy, Download, Eye, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toZonedTime } from "date-fns-tz";
import { format, formatDistanceToNow } from "date-fns";

import http from "@/lib/http";
import {
  ACTIVITY_DOWNLOAD_ACTION,
  ACTIVITY_SHARE_ACTION,
  ACTIVITY_VIEW_ACTION,
  ActivityAction,
} from "@/types/file_type";
import { addFileActivity } from "@/repository/file_repository";
import { bootIPFS, getInstance } from "@/lib/ipfs";
import { CID } from "multiformats/cid";
import * as Block from "multiformats/block";
import * as dagPB from "@ipld/dag-pb";
import { sha256 } from "@noble/hashes/sha256";

interface FileDetails {
  id: number;
  cid: string;
  category: string;
  type: string;
  name: string;
  extension: string;
  description: string;
  slug: string;
  size: number;
  visibility: string;
  createdAt: string;
  downloadsCount: number;
  viewsCount: number;
  sharesCount: number;
}

type Comment = {
  id: string;
  author: {
    name: string;
    avatar: string;
    initials: string;
  };
  content: string;
  date: string;
  likes: number;
  liked: boolean;
};

export default function FileDetailsSection() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const isOnline = true;

  const [downloadState, setDownloadState] = useState<
    "idle" | "preparing" | "downloading" | "complete" | "redownload"
  >("idle");

  const [copied, setCopied] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"; // Convert to GB
    } else if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB"; // Convert to MB
    } else if (bytes >= 1024) {
      return (bytes / 1024).toFixed(2) + " KB"; // Convert to KB
    } else {
      return bytes + " B"; // Show in Bytes if < 1KB
    }
  };

  const formatDate = (
    utcTimestamp: string,
    type: "standard" | "relative" = "standard",
  ) => {
    const timeZone = "Asia/Manila";
    const localTime = toZonedTime(utcTimestamp, timeZone);
    if (type === "relative") {
      return formatDistanceToNow(localTime, { addSuffix: true });
    }

    return format(localTime, "MMMM d, yyyy - h:mm a");
  };

  const truncateText = (
    text: string,
    limit: number,
    suffix = "...",
  ): string => {
    if (text.length <= limit) return text;

    const truncated = text.slice(0, limit).trim();
    return truncated + suffix;
  };

  const getFileDetails = async () => {
    try {
      // @ts-ignore
      const { data } = await http.get(`/api/file/record/${params.slug}`);
      if (data) {
        setFileDetails(data);
      }
    } catch (e) {
      console.log(e);
      // file not found.
    }
  };

  const addActivity = async (action: ActivityAction) => {
    if (fileDetails && fileDetails.id) {
      await addFileActivity(fileDetails.id, action);
    }
  };

  async function* traverseDag(block, bitswap) {
    // Decode the block (assuming it's a DAG-PB block)
    const decodedBlock = Block.decode({
      bytes: block,
      codec: dagPB,
      hasher: sha256,
    });

    if (decodedBlock.value instanceof Uint8Array) {
      // If the block is raw data, yield it
      yield decodedBlock.value;
    } else if (decodedBlock.value.Links) {
      // If the block has links, recursively fetch them
      for (const link of decodedBlock.value.Links) {
        const nextCid = CID.parse(link.Hash);
        const nextBlock = await bitswap.want(nextCid);
        yield* traverseDag(nextBlock, bitswap);
      }
    } else {
      // Handle other cases (e.g., directories)
      throw new Error("Unsupported DAG structure");
    }
  }

  const onDownload = async () => {
    if (!fileDetails?.cid) return;
    try {
      const { bitswap } = await getInstance(); // Get Helia Bitswap instance
      setDownloadState("preparing");

      const startTime = performance.now(); // Start time

      // Parse the CID
      const cid = CID.parse(fileDetails.cid);

      // Fetch the root block using Bitswap
      const rootBlock = await bitswap.want(cid);
      console.log("Root block: ", rootBlock);
      const chunks = [];

      // Traverse the DAG and fetch all blocks
      for await (const block of traverseDag(rootBlock, bitswap)) {
        chunks.push(block);
      }

      setDownloadState("downloading");

      // Combine all chunks into a single Uint8Array
      const uint8Array = new Uint8Array(
        chunks.reduce((acc, chunk) => [...acc, ...chunk], []),
      );

      // Create a Blob and trigger the download
      const blob = new Blob([uint8Array], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileDetails.name || "downloaded-file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const endTime = performance.now(); // End time
      const downloadDuration = ((endTime - startTime) / 1000).toFixed(2); // Convert to seconds

      console.log(`Download completed in ${downloadDuration} seconds`);

      setDownloadState("complete");
      addActivity(ACTIVITY_DOWNLOAD_ACTION, { duration: downloadDuration });

      setTimeout(() => setDownloadState("redownload"), 2000);
    } catch (error) {
      console.error("Download failed:", error);
      setDownloadState("error");
    }
  };

  const checkProviders = async (cidString: string) => {
    try {
      const { helia } = await getInstance(); // Get libp2p instance
      const cid = CID.parse(cidString); // Parse CID

      console.log(`🔍 Looking for providers of CID: ${cid}`);

      const providers = [];
      for await (const provider of helia.libp2p.contentRouting.findProviders(
        cid,
      )) {
        providers.push(provider);
        console.log("✅ Provider found:", provider);
      }

      return providers.length ? providers : "No providers found";
    } catch (error) {
      console.error("Error checking providers:", error);
      return "Error checking providers";
    }
  };

  const onHandleCopy = () => {
    if (fileDetails?.cid && process.env.NEXT_PUBLIC_URL) {
      navigator.clipboard.writeText(`${shareUrl}?share=1`);
      setCopied(true);
      toast("The file link has been copied to your clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadButtonText = useMemo(() => {
    const template = {
      idle: "DOWNLOAD NOW",
      preparing: "LOOKING YOUR FILE",
      downloading: "FINALIZING...",
      complete: "READY FOR DOWNLOAD!",
      redownload: "DOWNLOAD AGAIN",
    };

    return template[downloadState];
  }, [downloadState]);

  const disableDownloadButton = useMemo(() => {
    return (
      downloadState === "preparing" ||
      downloadState === "downloading" ||
      downloadState === "complete" ||
      !isOnline
    );
  }, [downloadButtonText]);

  useEffect(() => {
    bootIPFS();
    getFileDetails();
  }, []);

  useEffect(() => {
    if (fileDetails?.slug) {
      setShareUrl(`${process.env.NEXT_PUBLIC_URL}/file/${fileDetails.slug}`);
    }

    addActivity(ACTIVITY_VIEW_ACTION);

    if (searchParams.get("share")) {
      addActivity(ACTIVITY_SHARE_ACTION);
    }
  }, [fileDetails]);

  return (
    <div>
      {fileDetails ? (
        <div className="grid gap-6  lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-b">
              <CardHeader className="pb-3 space-y-6">
                <CardContent className="p-0">
                  <div className="bg-primary/5 p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Download className="h-8 w-8 text-primary" />
                    </div>
                    <div className="break-all">
                      <h2 className="text-2xl font-bold">
                        {truncateText(fileDetails.name, 50)}
                      </h2>
                      <p className="text-muted-foreground mt-1">
                        {fileDetails.type.toUpperCase()} •{" "}
                        {formatFileSize(fileDetails.size)} •{" "}
                        {formatDate(fileDetails.createdAt, "relative")}
                      </p>
                    </div>

                    <Button
                      size="lg"
                      className="mt-4 px-8 gap-2 bg-green-600 hover:bg-green-700 font-semibold dark:text-white"
                      onClick={onDownload}
                      disabled={disableDownloadButton}
                    >
                      <Download className="h-5 w-5" />
                      {downloadButtonText}
                    </Button>
                  </div>
                </CardContent>
                <div className="flex flex-col gap-2">
                  <div className="text-wrap">
                    <CardTitle className="text-2xl truncate">
                      {fileDetails.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        Uploaded {formatDate(fileDetails.createdAt, "relative")}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <Download className="h-3.5 w-3.5" />
                      <span>{fileDetails.downloadsCount} downloads</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {fileDetails.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs lowercase">
                      .{fileDetails.extension}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(fileDetails.size)}
                    </Badge>
                    <Badge className="bg-green-500 text-xs text-white">
                      Online
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="description" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="description">Description</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                  <TabsContent value="description" className="pt-4  text-wrap">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-wrap">
                      <p className="break-words">{fileDetails.description}</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="details" className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">File Type</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="capitalize">
                            {fileDetails.category}
                          </span>{" "}
                          /{" "}
                          <span className="lowercase">
                            .{fileDetails.extension}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Size</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(fileDetails.size)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(fileDetails.createdAt)}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="activity" className="py-4">
                    <div className="space-y-4">
                      <div className="flex items-start gap-2">
                        <Eye className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm">Last seen</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(fileDetails.createdAt, "relative")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Download className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm">File uploaded</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(fileDetails.createdAt, "relative")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  File Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Views</span>
                    </div>
                    <span className="font-medium">
                      {fileDetails.viewsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Downloads</span>
                    </div>
                    <span className="font-medium">
                      {fileDetails.downloadsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Shares</span>
                    </div>
                    <span className="font-medium">
                      {fileDetails.sharesCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Uploaded</span>
                    </div>
                    <span className="font-medium text-right">
                      {formatDate(fileDetails.createdAt, "relative")}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Share this file</p>
                  <div className="flex space-x-2">
                    <Input value={shareUrl} readOnly className="text-xs" />
                    <Button size="sm" variant="outline" onClick={onHandleCopy}>
                      {copied ? "Copied" : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div></div>
      )}
    </div>
  );
}
