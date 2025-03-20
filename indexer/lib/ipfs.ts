import { createHelia, HeliaLibp2p } from "helia";
import { createLibp2p, Libp2p } from "libp2p";
import { UnixFS, unixfs } from "@helia/unixfs";
import { webSockets } from "@libp2p/websockets";
import { Identify, identify } from "@libp2p/identify";
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub";
import { KadDHT, kadDHT } from "@libp2p/kad-dht";
import { noise } from "@chainsafe/libp2p-noise";
import { webTransport } from "@libp2p/webtransport";
import { webRTC } from "@libp2p/webrtc";
import {
  circuitRelayTransport,
  circuitRelayServer,
} from "@libp2p/circuit-relay-v2";
import { autoNAT } from "@libp2p/autonat";
import { tcp } from "@libp2p/tcp";
import { yamux } from "@chainsafe/libp2p-yamux";
import { keys } from "@libp2p/crypto";
import { generateKeyPair } from "@libp2p/crypto/keys";
import {
  RSAPrivateKey,
  Ed25519PrivateKey,
  Secp256k1PrivateKey,
  PubSub,
} from "@libp2p/interface";
import fs from "node:fs/promises";
import path from "node:path";

type Libp2pInstance = Libp2p<{
  dht: typeof kadDHT;
  pubsub: typeof gossipsub;
  identify: typeof identify;
}>;

type HeliaInstance = HeliaLibp2p<Libp2pInstance>;

let heliaInstance: HeliaInstance;
let unixFsInstance: UnixFS;
let libp2pInstance: Libp2p<{
  dht: KadDHT;
  pubsub: PubSub<GossipsubEvents>;
  identify: Identify;
}> | null = null;

const IPFS_KEYS_PATH = path.join(process.cwd(), "ipfs_keys.json");

const saveKeyPair = async (privateKey: Uint8Array, publicKey: Uint8Array) => {
  const data = {
    "helia-private-key": Buffer.from(privateKey).toString("base64"),
    "helia-public-key": Buffer.from(publicKey).toString("base64"),
  };

  await fs.writeFile(IPFS_KEYS_PATH, JSON.stringify(data, null, 2), "utf-8");
};

const loadKeyPair = async () => {
  try {
    const fileContent = await fs.readFile(IPFS_KEYS_PATH, "utf-8");
    const data = JSON.parse(fileContent);
    if (!data["helia-private-key"] || !data["helia-public-key"]) {
      return null;
    }
    const privateKey = keys.privateKeyFromRaw(
      Buffer.from(data["helia-private-key"], "base64"),
    );
    const publicKey = keys.publicKeyFromRaw(
      Buffer.from(data["helia-public-key"], "base64"),
    );

    return { privateKey, publicKey };
  } catch (error) {
    return null;
  }
};

export async function bootIPFS() {
  try {
    const keyPair = await loadKeyPair();
    let privateKey: RSAPrivateKey | Ed25519PrivateKey | Secp256k1PrivateKey;

    if (keyPair) {
      privateKey = keyPair.privateKey;
    } else {
      privateKey = await generateKeyPair("RSA");
      await saveKeyPair(privateKey.raw, privateKey.publicKey.raw);
    }

    libp2pInstance = await initializeLibp2p(privateKey);

    // @ts-expect-error
    heliaInstance = await initializeHelia(libp2pInstance); // Exception haha
    unixFsInstance = unixfs(heliaInstance);

    console.log(`PeerID: ${heliaInstance.libp2p.peerId.toString()}`);
  } catch (e) {
    console.error("Error connecting to the custom IPFS server:", e);
  }
}

const initializeLibp2p = async (
  privateKey: RSAPrivateKey | Ed25519PrivateKey | Secp256k1PrivateKey,
) => {
  const libp2p = await createLibp2p({
    privateKey,
    transports: [
      tcp(),
      webSockets(),
      webTransport(),
      webRTC(),
      circuitRelayTransport(),
    ],
    addresses: {
      listen: [
        // Only change to a different port for development purposes only to fix the ports conflicts issue..
        "/ip4/0.0.0.0/tcp/4005", // Make this port dynamic and default to 4001
        "/ip4/0.0.0.0/tcp/4002/ws", // Make this port dynamic and default to 4002
        "/ip4/0.0.0.0/udp/4001/webrtc-direct", // Make this port dynamic and default to 4001
        "/ip4/0.0.0.0/tcp/0",
        "/p2p-circuit",
      ],
    },
    streamMuxers: [yamux()],
    connectionEncrypters: [noise()],
    services: {
      dht: kadDHT({ clientMode: false }),
      pubsub: gossipsub(),
      identify: identify(),
      autoNAT: autoNAT(),
      circuitRelayServer: circuitRelayServer(), // @TODO: Make it work the relay server. Maybe save the peerID and store it with file details.
    },
  });

  await libp2p.start();
  return libp2p;
};

const initializeHelia = async (libp2p: Libp2pInstance) => {
  const helia = await createHelia({
    libp2p,
  });

  helia.libp2p.addEventListener("peer:connect", async (evt) => {
    const peerId = evt.detail;
    console.log("Peer connected:", peerId.toString());

    try {
      console.log("Dialing back to peer...");
      await helia.libp2p.dial(peerId); // Connect back to them
      console.log("Successfully connected back to peer:", peerId.toString());
      console.log(
        "Peers: ",
        helia.libp2p.getPeers().map((peer) => peer.toString()),
      );
    } catch (error) {
      console.error("Failed to connect back:", error);
    }
  });

  return helia;
};

export async function getInstance() {
  return {
    helia: heliaInstance,
    fs: unixFsInstance,
  };
}

export async function stopIPFS() {
  if (heliaInstance) {
    await heliaInstance.stop();
  }
  if (libp2pInstance) {
    await libp2pInstance.stop();
  }
}
