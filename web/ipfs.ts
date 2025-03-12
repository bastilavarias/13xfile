import { createHelia } from "helia";
import { unixfs, UnixFS } from "@helia/unixfs";

let heliaInstance: any = null;
let unixFsInstance: UnixFS | null = null;

export async function startIpfs() {
  if (heliaInstance && unixFsInstance) {
    return;
  }

  console.log("Starting Helia and connecting to IPFS daemon...");

  try {
    heliaInstance = await createHelia();
    unixFsInstance = unixfs(heliaInstance);

    console.log("Helia is ready!");
  } catch (e) {
    console.error("Error connecting to IPFS daemon:", e);
  }
}

export async function getInstance() {
  return { helia: heliaInstance, fs: unixFsInstance };
}
