import { createHelia, HeliaLibp2p } from "helia";
import { createLibp2p, Libp2p } from "libp2p";
import { UnixFS, unixfs } from "@helia/unixfs";
import { webSockets } from "@libp2p/websockets";
import { bootstrap } from "@libp2p/bootstrap";
import { Identify, identify } from "@libp2p/identify";
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub";
import { KadDHT, kadDHT } from "@libp2p/kad-dht";
import { multiaddr } from "@multiformats/multiaddr";
import { noise } from "@chainsafe/libp2p-noise";
import { keys } from "@libp2p/crypto";
import { get, set } from "idb-keyval";
import { IDBBlockstore } from "blockstore-idb";
import { generateKeyPair } from "@libp2p/crypto/keys";
import {
  RSAPrivateKey,
  Ed25519PrivateKey,
  Secp256k1PrivateKey,
  PubSub,
} from "@libp2p/interface";

type Libp2pInstance = Libp2p<{
  dht: typeof kadDHT;
  pubsub: typeof gossipsub;
  identify: typeof identify;
}>;

type HeliaInstance = HeliaLibp2p<Libp2pInstance>;

let heliaInstance: HeliaInstance | null = null;
let unixFsInstance: UnixFS | null = null;
let libp2pInstance: Libp2p<{
  dht: KadDHT;
  pubsub: PubSub<GossipsubEvents>;
  identify: Identify;
}> | null = null;

const DHT_IP = "";
const DHT_PEER_ID = "";
const DHT_MULTIADDR = multiaddr(
  `/ip4/${DHT_IP}/tcp/4002/ws/p2p/${DHT_PEER_ID}`,
);

const saveKeyPair = async (privateKey: Uint8Array, publicKey: Uint8Array) => {
  await set("helia-private-key", Buffer.from(privateKey).toString("base64"));
  await set("helia-public-key", Buffer.from(publicKey).toString("base64"));
};

const loadKeyPair = async () => {
  const privateKeyBase64 = await get("helia-private-key");
  const publicKeyBase64 = await get("helia-public-key");

  if (!privateKeyBase64 || !publicKeyBase64) {
    return null;
  }

  const privateKey = keys.privateKeyFromRaw(
    Buffer.from(privateKeyBase64, "base64"),
  );
  const publicKey = keys.publicKeyFromRaw(
    Buffer.from(publicKeyBase64, "base64"),
  );

  return { privateKey, publicKey };
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
    console.log("libp2p Peer ID:", libp2pInstance.peerId.toString());

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    heliaInstance = await initializeHelia(libp2pInstance); // Exception haha
    unixFsInstance = unixfs(heliaInstance);

    await checkDHTConnection(heliaInstance);
    console.log("Helia is ready and connected to the custom IPFS server!");
  } catch (e) {
    console.error("Error connecting to the custom IPFS server:", e);
  }
}

const initializeLibp2p = async (
  privateKey: RSAPrivateKey | Ed25519PrivateKey | Secp256k1PrivateKey,
) => {
  const libp2p = await createLibp2p({
    privateKey,
    transports: [webSockets()],
    connectionEncrypters: [noise()],
    peerDiscovery: [
      bootstrap({
        list: [DHT_MULTIADDR.toString()],
      }),
    ],
    services: {
      dht: kadDHT({ clientMode: false }),
      pubsub: gossipsub(),
      identify: identify(),
    },
  });

  await libp2p.start();
  return libp2p;
};

const initializeHelia = async (libp2p: Libp2pInstance) => {
  const blockstore = new IDBBlockstore("files");
  await blockstore.open();

  const helia = await createHelia({
    libp2p,
    blockstore,
  });

  await helia.libp2p.dial(DHT_MULTIADDR);

  return helia;
};

const checkDHTConnection = async (helia: HeliaInstance) => {
  const libp2p = helia.libp2p;
  const peers = libp2p.getPeers();

  if (peers.length === 0) {
    console.log("❌ Not connected to any DHT peers.");
    return;
  }

  console.log(`✅ Connected to ${peers.length} DHT peers.`);

  if (!libp2p.services.dht) {
    console.log("❌ DHT service is not enabled.");
    return;
  }
};

export async function getInstance() {
  return { helia: heliaInstance, fs: unixFsInstance };
}

export async function stopIPFS() {
  if (heliaInstance) {
    await heliaInstance.stop();
  }
  if (libp2pInstance) {
    await libp2pInstance.stop();
  }
}

// @TODO: Separate the logics of upload, get, check functions may put it on helpers and use in services and put dht server congs in env.
