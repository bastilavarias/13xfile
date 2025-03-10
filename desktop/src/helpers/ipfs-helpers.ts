export function getIPFSInstance(): boolean {
  return window.ipfs.getInstance();
}

export async function uploadFileToIPFS(file: File) {
  return await window.ipfs.store(await file.arrayBuffer());
}

export async function checkFileStatusFromIPFS(cid: string) {
  return await window.ipfs.checkStatus(cid);
}
