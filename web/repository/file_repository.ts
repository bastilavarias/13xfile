import { ActivityAction } from "@/types/fileType";
import http from "@/lib/http";

export const addFileActivity = async (
  fileID: number,
  action: ActivityAction,
) => {
  try {
    // @ts-ignore
    const { data } = await http.post("/api/file/activity", {
      file_id: fileID,
      action,
    });
    if (data) {
      return data;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const getDownloadFile = async (cid: string) => {
  try {
    // @ts-ignore
    const { data } = await http.get(`/api/ipfs/download/${cid}`);
    if (data) {
      return data;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
};
