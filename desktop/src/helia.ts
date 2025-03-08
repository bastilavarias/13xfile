let heliaInstance: any = null;
let fsInstance: any = null;

export async function getHelia() {
  if (!heliaInstance) {
    const { createHelia } = await import("helia");
    const { unixfs } = await import("@helia/unixfs");
    heliaInstance = await createHelia();
    fsInstance = unixfs(heliaInstance);
  }

  return { helia: heliaInstance, fs: fsInstance };
}

export async function uploadFile(
  file: File,
): Promise<{ cid: string; filename: string } | null> {
  try {
    const { fs } = await getHelia();
    if (!fs) throw new Error("Helia filesystem (fs) is not initialized.");
    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    const cid = await fs.addBytes(fileBuffer);
    console.log("File uploaded, CID:", cid.toString());
    console.log(
      `Access it locally: http://127.0.0.1:8080/ipfs/${cid.toString()}`,
    );

    return { cid: cid.toString(), filename: file.name }; // Return CID and filename
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

export async function downloadFile(
  cid: string,
  filename: string,
): Promise<boolean> {
  try {
    const { fs: ipfsFs } = await getHelia();
    if (!ipfsFs) throw new Error("Helia filesystem (fs) is not initialized.");
    const chunks: Uint8Array[] = [];
    for await (const chunk of ipfsFs.cat(cid)) {
      chunks.push(chunk);
    }
    const fileBuffer = new Uint8Array(
      chunks.reduce((acc, val) => [...acc, ...val], []),
    );
    if (!window.electronWindow?.saveFile)
      throw new Error("Electron saveFile is not initialized.");

    window.electronWindow.saveFile({
      filename, // Use the original filename
      content: fileBuffer,
    });

    return true;
  } catch (error) {
    console.error("Error downloading file:", error);
    return false;
  }
}
