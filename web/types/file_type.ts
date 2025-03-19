export const ACTIVITY_VIEW_ACTION = "view";
export const ACTIVITY_SHARE_ACTION = "share";
export const ACTIVITY_DOWNLOAD_ACTION = "download";

export type ActivityAction =
  | typeof ACTIVITY_VIEW_ACTION
  | typeof ACTIVITY_SHARE_ACTION
  | typeof ACTIVITY_DOWNLOAD_ACTION;
