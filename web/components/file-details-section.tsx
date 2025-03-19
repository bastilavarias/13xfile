"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Download,
  Calendar,
  Heart,
  MessageSquare,
  Flag,
  MoreHorizontal,
  Share2,
  Copy,
  Facebook,
  Twitter,
  CheckCircle,
  Clock,
  Eye,
} from "lucide-react";
import Image from "next/image";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toZonedTime } from "date-fns-tz";
import { formatDistanceToNow, format } from "date-fns";

import http from "@/lib/http";

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
  const [details, setDetails] = useState(null);
  const isOnline = true;

  // Download state
  const [downloadState, setDownloadState] = useState<
    "idle" | "preparing" | "downloading" | "complete"
  >("idle");
  const [progress, setProgress] = useState(0);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([
    {
      id: "1",
      author: {
        name: "Alex Johnson",
        avatar: "",
        initials: "AJ",
      },
      content: "Great image! Thanks for sharing this resource.",
      date: "1 day ago",
      likes: 5,
      liked: false,
    },
    {
      id: "2",
      author: {
        name: "Sam Taylor",
        avatar: "",
        initials: "ST",
      },
      content:
        "I've been looking for something like this. The quality is excellent!",
      date: "2 days ago",
      likes: 3,
      liked: false,
    },
  ]);
  const [newComment, setNewComment] = useState("");
  const [copied, setCopied] = useState(false);
  const shareUrl = "https://13xfile.com/downloaded_image.jpg";

  // Similar files data
  const similarFiles = [
    {
      id: "1",
      name: "landscape.jpg",
      thumbnail: "/placeholder.svg?height=100&width=100",
      type: "JPG",
      size: "245 KB",
    },
    {
      id: "2",
      name: "profile.jpg",
      thumbnail: "/placeholder.svg?height=100&width=100",
      type: "JPG",
      size: "189 KB",
    },
    {
      id: "3",
      name: "document.jpg",
      thumbnail: "/placeholder.svg?height=100&width=100",
      type: "JPG",
      size: "320 KB",
    },
  ];

  // Your existing functions
  const getFileDetails = async () => {
    try {
      const { data } = await http.get(`/api/file/record/${params.slug}`);
      if (data) {
        setDetails(data);
      }
    } catch (e) {
      console.log(e);
      // file not found.
    }
  };

  const onDownload = async () => {
    setDownloadState("preparing");
    setProgress(0);

    // Simulate preparing download
    setTimeout(async () => {
      setDownloadState("downloading");

      try {
        const response = await fetch(
          `http://localhost:3333/api/ipfs/download/QmaXwVD8eCmABPKtGu7dC6szPxywjhuLotbdD3Qjuxasyt`,
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        // Simulate download progress
        const interval = setInterval(() => {
          setProgress((prev) => {
            const newProgress = prev + Math.random() * 10;
            if (newProgress >= 100) {
              clearInterval(interval);
              completeDownload(response);
              return 100;
            }
            return newProgress;
          });
        }, 300);
      } catch (error) {
        console.error(error);
        alert("Failed to download file. Please try again.");
        setDownloadState("idle");
      }
    }, 1500);
  };

  const completeDownload = async (response: Response) => {
    try {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ipfs-image.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadState("complete");
      toast({
        title: "Download complete",
        description: "Your file has been downloaded successfully",
      });
    } catch (error) {
      console.error(error);
      alert("Failed to download file. Please try again.");
      setDownloadState("idle");
    }
  };

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

  const formatDate = (utcTimestamp: string, type: string = "standard") => {
    const timeZone = "Asia/Manila";
    const localTime = toZonedTime(utcTimestamp, timeZone);
    if (type === "relative") {
      return formatDistanceToNow(localTime, { addSuffix: true });
    }

    return format(localTime, "MMMM d, yyyy - h:mm a");
  };

  // Comment functions
  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: {
        name: "You",
        avatar: "",
        initials: "YO",
      },
      content: newComment,
      date: "Just now",
      likes: 0,
      liked: false,
    };

    setComments([comment, ...comments]);
    setNewComment("");
  };

  const handleLike = (id: string) => {
    setComments(
      comments.map((comment) => {
        if (comment.id === id) {
          return {
            ...comment,
            likes: comment.liked ? comment.likes - 1 : comment.likes + 1,
            liked: !comment.liked,
          };
        }
        return comment;
      }),
    );
  };

  // Share functions
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: "Link copied",
      description: "The file link has been copied to your clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    getFileDetails();
  }, []);

  // Mock data for when API hasn't loaded yet
  const mockDetails = {
    name: "downloaded_image.jpg",
    type: "jpg",
    category: "image",
    size: 314470,
    description:
      "This is an image file uploaded 2 days ago. Add your description here to help others understand what this file contains.",
  };

  const fileDetails = details || mockDetails;

  return (
    <div>
      {details ? (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-10">
          <div className="lg:col-span-2 space-y-6">
            {/* File Details - Using your existing code structure */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-2xl">{details.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        Uploaded {formatDate(details.createdAt, "relative")}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <Download className="h-3.5 w-3.5" />
                      <span>{details.downloadsView} downloads</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {details.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs lowercase">
                      .{details.extension}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(details.size)}
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
                      <p className="break-words">{details.description}</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="details" className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">File Type</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="capitalize">{details.category}</span>{" "}
                          /{" "}
                          <span className="lowercase">
                            .{details.extension}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Size</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(details.size)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(details.createdAt)}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="activity" className="pt-4">
                    <div className="space-y-4">
                      <div className="flex items-start gap-2">
                        <Eye className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm">Last seen</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(details.createdAt, "relative")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Download className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm">File uploaded</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(details.createdAt, "relative")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Download Section - Enhanced UI with your functionality */}
            <Card className="overflow-hidden border-2 border-primary/20">
              <CardContent className="p-0">
                <div className="bg-primary/5 p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Download className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{fileDetails.name}</h2>
                    <p className="text-muted-foreground mt-1">
                      {fileDetails.type.toUpperCase()} •{" "}
                      {formatFileSize(fileDetails.size)} •{" "}
                      {formatDate(details.createdAt, "relative")}
                    </p>
                  </div>

                  {downloadState === "idle" && (
                    <Button
                      size="lg"
                      className="mt-4 px-8 gap-2 bg-green-600 hover:bg-green-700 font-semibold dark:text-white"
                      onClick={onDownload}
                      disabled={!isOnline}
                    >
                      <Download className="h-5 w-5" />
                      DOWNLOAD NOW
                    </Button>
                  )}

                  {downloadState === "preparing" && (
                    <div className="w-full max-w-md space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <Clock className="h-5 w-5 animate-pulse" />
                        <span>Preparing download...</span>
                      </div>
                      <Progress value={15} className="h-2" />
                    </div>
                  )}

                  {downloadState === "downloading" && (
                    <div className="w-full max-w-md space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <Download className="h-5 w-5 animate-pulse" />
                        <span>Downloading... {Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  {downloadState === "complete" && (
                    <div className="w-full max-w-md space-y-4">
                      <div className="flex items-center justify-center gap-2 text-green-500">
                        <CheckCircle className="h-5 w-5" />
                        <span>Download complete!</span>
                      </div>
                      <Button
                        variant="outline"
                        size="lg"
                        className="mt-2"
                        onClick={() => setDownloadState("idle")}
                      >
                        Download Again
                      </Button>
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t">
                  <div />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Report Issue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comment Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments ({comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Avatar>
                      <AvatarFallback>YO</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="resize-none"
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                        >
                          Post Comment
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mt-6">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar>
                          <AvatarImage src={comment.author.avatar} />
                          <AvatarFallback>
                            {comment.author.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {comment.author.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {comment.date}
                              </span>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">More</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Flag className="mr-2 h-4 w-4" />
                                  Report
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <p className="mt-1 text-sm">{comment.content}</p>
                          <div className="mt-2 flex items-center gap-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 px-2 text-muted-foreground"
                              onClick={() => handleLike(comment.id)}
                            >
                              <Heart
                                className={`h-4 w-4 ${comment.liked ? "fill-red-500 text-red-500" : ""}`}
                              />
                              <span>{comment.likes}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 px-2 text-muted-foreground"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* File Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  File Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Views</span>
                    </div>
                    <span className="font-medium">{details.viewsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Downloads</span>
                    </div>
                    <span className="font-medium">
                      {details.downloadsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Shares</span>
                    </div>
                    <span className="font-medium">
                      {details.downloadsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Uploaded</span>
                    </div>
                    <span className="font-medium">2 days ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Share Buttons */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Share This File
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input value={shareUrl} readOnly className="text-xs" />
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? "Copied" : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Facebook className="mr-2 h-4 w-4" />
                    Facebook
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Twitter className="mr-2 h-4 w-4" />
                    Twitter
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Link href="#" className="mr-2 h-4 w-4" />
                    Direct
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Similar Files */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Similar Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {similarFiles.map((file) => (
                    <Link href="#" key={file.id}>
                      <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
                        <div className="relative h-10 w-10 overflow-hidden rounded-md border">
                          <Image
                            src={file.thumbnail || "/placeholder.svg"}
                            alt={file.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm font-medium">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {file.type} • {file.size}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
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
