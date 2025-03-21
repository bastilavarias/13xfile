import { createHelia, HeliaLibp2p } from "helia";
import { createLibp2p, Libp2p } from "libp2p";
import { createBitswap, Bitswap } from "@helia/bitswap";
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
import { bootstrap } from "@libp2p/bootstrap";
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
import { multiaddr } from "@multiformats/multiaddr";
import { get, set } from "idb-keyval";

type Libp2pInstance = Libp2p<{
  dht: typeof kadDHT;
  pubsub: typeof gossipsub;
  identify: typeof identify;
}>;

type HeliaInstance = HeliaLibp2p<Libp2pInstance>;

let heliaInstance: HeliaInstance;
let unixFsInstance: UnixFS;
let bitswapInstance: Bitswap;
let libp2pInstance: Libp2p<{
  dht: KadDHT;
  pubsub: PubSub<GossipsubEvents>;
  identify: Identify;
}> | null = null;
const IPFS_KEYS_PATH = "helia-keys";
const DHT_IP = process.env.NEXT_PUBLIC_DHT_IP;
const DHT_PEER_ID = process.env.NEXT_PUBLIC_DHT_PEER_ID;
const DHT_MULTIADDR = [
  `/ip4/${DHT_IP}/tcp/4002/ws/p2p/${DHT_PEER_ID}`,
  `/ip4/${DHT_IP}/udp/4001/webrtc-direct/p2p/${DHT_PEER_ID}`,
  `/p2p-circuit/p2p/${DHT_PEER_ID}`,
];

const saveKeyPair = async (privateKey: Uint8Array, publicKey: Uint8Array) => {
  const data = {
    privateKey: Buffer.from(privateKey).toString("base64"),
    publicKey: Buffer.from(publicKey).toString("base64"),
  };

  await set(IPFS_KEYS_PATH, data);
};

const loadKeyPair = async () => {
  try {
    const data = await get<{ privateKey: string; publicKey: string }>(
      IPFS_KEYS_PATH,
    );
    if (!data) {
      console.warn("No key pair found in IndexedDB.");
      return null;
    }
    const privateKey = keys.privateKeyFromRaw(
      Buffer.from(data.privateKey, "base64"),
    );
    const publicKey = keys.publicKeyFromRaw(
      Buffer.from(data.publicKey, "base64"),
    );

    return { privateKey, publicKey };
  } catch (error) {
    console.error("Failed to load key pair:", error);
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

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
      webSockets(),
      webTransport(),
      webRTC(),
      circuitRelayTransport(),
    ],
    addresses: {
      listen: [
        // Only change to a different port for development purposes only to fix the ports conflicts issue..
        "/ip4/0.0.0.0/tcp/4005", // Make this port dynamic and default to 4001
        "/ip4/0.0.0.0/udp/4001/webrtc-direct", // Make this port dynamic and default to 4001
        "/ip4/0.0.0.0/tcp/0",
        "/p2p-circuit",
      ],
    },
    peerDiscovery: [bootstrap({ list: DHT_MULTIADDR })],
    streamMuxers: [yamux()],
    connectionEncrypters: [noise()],
    services: {
      dht: kadDHT({ clientMode: false }),
      pubsub: gossipsub(),
      identify: identify(),
      autoNAT: autoNAT(),
      circuitRelayServer: circuitRelayServer(),
    },
  });

  await libp2p.start();
  return libp2p;
};

const initializeHelia = async (libp2p: Libp2pInstance) => {
  const helia = await createHelia({
    libp2p,
  });

  bitswapInstance = createBitswap(helia);

  for (const addr of DHT_MULTIADDR) {
    await helia.libp2p.dial(multiaddr(addr));
  }

  helia.libp2p.addEventListener("peer:connect", async (evt) => {
    const peerId = evt.detail;
    console.log("Peer connected from web:", peerId.toString());

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
    bitswap: bitswapInstance,
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
