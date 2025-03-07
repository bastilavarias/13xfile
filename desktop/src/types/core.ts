import {FileType} from "@/types/color";

export interface CoreFile {
    type: FileType;
    name: string;
    size: string;
    visibility?: string;
}