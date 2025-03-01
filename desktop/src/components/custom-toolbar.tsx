import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CARD_VIEW_MODE,
  SORT_ASC,
  SORT_DESC,
  TABLE_VIEW_MODE,
} from "@/constants";
import {
  File,
  Folder,
  Rows2,
  Search,
  SortAsc,
  SortDesc,
  Table2,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import AppTooltip from "@/components/app-tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface CustomToolbarProps {
  viewMode: string;
  setViewMode: (mode: string) => void;
  sort: string;
  setSort: (sort: string) => void;
}

const FormSchema = z.object({
  type: z.enum(["all", "mentions", "none"], {
    required_error: "You need to select a notification type.",
  }),
});

export default function CustomToolbar({
  viewMode,
  setViewMode,
  sort,
  setSort,
}: CustomToolbarProps) {
  return (
    <>
      <Card className="mb-4 overflow-hidden py-0 shadow-none">
        <div className="flex items-center gap-2 rounded-md border-t-0 border-b-0 px-3 py-2">
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
              <ShareButton />
            </div>
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex-1" />
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <AppTooltip label="View mode">
                  <Button variant="outline" size="icon">
                    {viewMode === CARD_VIEW_MODE ? <Rows2 /> : <Table2 />}
                  </Button>
                </AppTooltip>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setViewMode(CARD_VIEW_MODE)}>
                <Rows2 /> Card
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode(TABLE_VIEW_MODE)}>
                <Table2 /> Table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <AppTooltip label="Change order">
                  <Button variant="outline" size="icon">
                    {sort === SORT_ASC ? <SortAsc /> : <SortDesc />}
                  </Button>
                </AppTooltip>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSort(SORT_ASC)}>
                <SortAsc /> Ascending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort(SORT_DESC)}>
                <SortDesc /> Descending
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}

function ShareButton() {
  const [isSingleUploaderDialogOpen, setSingleUploaderDialogOpen] =
    useState(false);
  const [isFolderUploaderDialogOpen, setFolderUploaderDialogOpen] =
    useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" className="gap-1">
            <Upload className="h-4 w-4" />
            <span>Share File</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setSingleUploaderDialogOpen(true)}>
            <File className="text-primary" />
            Upload File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFolderUploaderDialogOpen(true)}>
            <Folder className="text-primary" />
            Upload Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={isSingleUploaderDialogOpen}
        onOpenChange={setSingleUploaderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <Form {...form}>
              <form className="space-y-5">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl className="w-full">
                        <Input id="file-upload" type="file" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl className="w-full">
                        <Textarea placeholder="Description" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Visibility</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-y-0">
                            <FormControl>
                              <RadioGroupItem value="public" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Public
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0">
                            <FormControl>
                              <RadioGroupItem value="private" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Private
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>

          {/* Dialog Footer */}
          <DialogFooter>
            <Button>
              <Upload /> Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFolderUploaderDialogOpen}
        onOpenChange={setFolderUploaderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Folder</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <p className="text-muted-foreground text-sm">
              Folder uploads are not currently supported. In the meantime,
              <span className="font-bold"> 13xFile </span> recommend compressing
              the folder into a zip/rar file and uploading it for sharing.
            </p>

            <Form {...form}>
              <form className="space-y-5">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl className="w-full">
                        <Input
                          id="file-upload"
                          type="file"
                          accept=".zip,.rar"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl className="w-full">
                        <Textarea placeholder="Description" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Visibility</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-y-0">
                            <FormControl>
                              <RadioGroupItem value="public" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Public
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0">
                            <FormControl>
                              <RadioGroupItem value="private" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Private
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>

          {/* Dialog Footer */}
          <DialogFooter>
            <Button>
              <Upload /> Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
