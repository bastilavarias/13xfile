import { getInstance } from "@/lib/ipfs";
import { CID } from "multiformats/cid";

const ipfsHelper = {
  async upload(file: File): Promise<string> {
    const { fs } = await getInstance();
    if (!fs) throw new Error("IPFS is not initialized.");

    const fileBuffer = await file.arrayBuffer();
    const cid = await fs.addBytes(new Uint8Array(fileBuffer));

    return cid.toString();
  },

  async get(cid: string): Promise<Uint8Array> {
    const { fs } = await getInstance();
    if (!fs) throw new Error("IPFS is not initialized.");

    const chunks: Uint8Array[] = [];
    for await (const chunk of fs.cat(CID.parse(cid))) {
      chunks.push(chunk);
    }

    return new Uint8Array(
      chunks.reduce((acc, chunk) => [...acc, ...chunk], []),
    );
  },

  async check(cid: string): Promise<boolean> {
    const { fs } = await getInstance();
    if (!fs) throw new Error("IPFS is not initialized.");

    for await (const chunk of fs.cat(CID.parse(cid))) {
      if (chunk) {
        return true;
      }
    }

    return false;
  },

  async ready(): Promise<boolean> {
    const { fs, helia } = await getInstance();
    return !!fs && !!helia;
  },
};

export default ipfsHelper;
