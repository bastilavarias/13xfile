export function isIPFSRunning(): boolean {
  return window.ipfs.isRunning();
}

export async function uploadFileToIPFS(file: File) {
  return await window.ipfs.store(await file.arrayBuffer());
}

export async function checkFileStatusFromIPFS(cid: string) {
  return await window.ipfs.checkStatus(cid);
}
