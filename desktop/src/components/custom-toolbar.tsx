import React, { useState, useRef } from "react";
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
  AlertCircle,
  Archive,
  File,
  FileText,
  FileType,
  Music,
  Package,
  Rows2,
  Search,
  SortAsc,
  SortDesc,
  Table2,
  Upload,
  Video,
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
import { cn } from "@/utils/tailwind";
import { extractFileObject } from "@/helpers/file_helpers";

interface CustomToolbarProps {
  viewMode: string;
  setViewMode: (mode: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  extension?: React.ReactNode;
  hasButtons?: boolean;
}

const FormSchema = z.object({
  file: z.any().refine((files) => files?.length > 0, "File is required"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  visibility: z.enum(["public", "private"], {
    required_error: "Visibility is required",
  }),
});

export default function CustomToolbar({
  viewMode,
  setViewMode,
  sort,
  setSort,
  extension = null,
  hasButtons,
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
      <div className="flex flex-wrap items-center justify-between gap-1">
        {extension ? extension : <div className="flex-1" />}
        {hasButtons && (
          <div className="flex gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div>
                  <AppTooltip label="View mode">
                    <Button variant="outline" size="icon">
                      <FileType />
                    </Button>
                  </AppTooltip>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <FileText />
                  Document
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Video />
                  Video
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Music />
                  Music
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Package />
                  Applications
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive />
                  Archives
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        )}
      </div>
    </>
  );
}

const ShareButton = () => {
  const [isSingleUploaderDialogOpen, setSingleUploaderDialogOpen] =
    useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      file: null,
      description: "",
      visibility: "public",
    },
  });

  const resetUploadState = () => {
    setUploadError("");
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetUploadState();
    }
    setSingleUploaderDialogOpen(open);
  };

  const onFormSubmit = async () => {
    try {
      setUploadError("");
      const formValues = form.getValues();
      const file = await formValues.file[0];
      const metadata = extractFileObject(file);
      window.file.upload({
        file: await file.arrayBuffer(),
        visibility: formValues.visibility,
        description: formValues.description,
        metadata,
      });
      setSingleUploaderDialogOpen(false);
      form.reset();
      resetUploadState();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    }
  };

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
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={isSingleUploaderDialogOpen}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <p className="text-muted-foreground text-sm">
              Folder uploads are not currently supported. In the meantime,
              <span className="font-bold"> 13xFile </span> recommend compressing
              the folder into a zip/rar file and uploading it for sharing.
            </p>
            <Form {...form}>
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit(onFormSubmit)}
              >
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select File</FormLabel>
                      <div className="relative truncate">
                        <input
                          type="file"
                          id="file-upload"
                          ref={fileInputRef}
                          onChange={(e) => field.onChange(e.target.files)}
                          className="sr-only"
                        />
                        <Label
                          htmlFor="file-upload"
                          className={cn(
                            "hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors",
                            form.formState.errors.file
                              ? "border-destructive"
                              : "border-input",
                          )}
                        >
                          <span className="truncate">
                            {field.value && field.value[0]
                              ? field.value[0].name
                              : "Choose File"}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                          >
                            Browse
                          </Button>
                        </Label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-y-1"
                        >
                          <FormItem className="flex items-center space-y-0">
                            <FormControl>
                              <RadioGroupItem value="public" />
                            </FormControl>
                            <FormLabel className="ml-2 font-normal">
                              Public
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0">
                            <FormControl>
                              <RadioGroupItem disabled value="private" />
                            </FormControl>
                            <FormLabel className="text-muted-foreground ml-2 font-normal">
                              Private (Soon)
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter file description"
                          {...field}
                          className={cn(
                            form.formState.errors.description
                              ? "border-destructive"
                              : "",
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {uploadError && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper Label component for file input styling
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
