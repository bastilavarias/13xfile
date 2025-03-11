import { createHelia } from "helia";
import { unixfs, UnixFS } from "@helia/unixfs";
import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { kadDHT, removePrivateAddressesMapper } from "@libp2p/kad-dht";
import { peerIdFromString } from "@libp2p/peer-id";

import { multiaddr } from "@multiformats/multiaddr";
import { strings } from "@helia/strings";

let heliaInstance: any = null;
let unixFsInstance: UnixFS | null = null;

export async function startIpfs() {
  if (heliaInstance && unixFsInstance) {
    return;
  }

  console.log("Starting Helia and connecting to IPFS daemon...");

  try {
    const libp2p = await createLibp2p({
      services: {
        identify: identify(),
        aminoDHT: kadDHT({
          protocol: "/ipfs/kad/1.0.0",
        }),
      },
    });

    // Replace with the Peer ID from your `ipfs id` output
    const peerId = peerIdFromString(
      "12D3KooWAoxEfs6UrVaDBRFEKDvYZBFXxtsyBW1UYB4jqTGGWUGZ",
    );

    // Replace with one of the addresses from `ipfs id` output
    const multiAddr = multiaddr(
      "/ip4/175.176.31.13/tcp/4001/p2p/12D3KooWAoxEfs6UrVaDBRFEKDvYZBFXxtsyBW1UYB4jqTGGWUGZ",
    ); // TODO: Fix this

    // Add the peer to the peer store
    await libp2p.peerStore.patch(peerId, { multiaddrs: [multiAddr] });

    // Dial the IPFS daemon
    await libp2p.dial(multiAddr);
    console.log("Connected to IPFS daemon!");

    // Create Helia with the libp2p instance
    heliaInstance = await createHelia({ libp2p });
    unixFsInstance = unixfs(heliaInstance);

    console.log("Helia is ready!");
  } catch (e) {
    console.error("Error connecting to IPFS daemon:", e);
  }
}

export async function getInstance() {
  return { helia: heliaInstance, fs: unixFsInstance };
}
