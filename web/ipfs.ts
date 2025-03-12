import { createHelia } from "helia";
import { createLibp2p } from "libp2p";
import { unixfs } from "@helia/unixfs";
import { webSockets } from "@libp2p/websockets";
import { bootstrap } from "@libp2p/bootstrap";
import { identify } from "@libp2p/identify";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { kadDHT } from "@libp2p/kad-dht";
import { multiaddr } from "multiaddr";
import { noise } from "@chainsafe/libp2p-noise";

let heliaInstance: any = null;
let unixFsInstance: any = null;

export async function startIpfs() {
  if (heliaInstance && unixFsInstance) {
    return;
  }
  try {
    const serverIP = "";
    const serverPeerID = "";
    const libp2p = await createLibp2p({
      transports: [webSockets()],
      connectionEncrypters: [noise()], //
      peerDiscovery: [
        bootstrap({
          list: [`/ip4/${serverIP}/tcp/4002/ws/p2p/${serverPeerID}`],
        }),
      ],
      services: {
        dht: kadDHT({ clientMode: false }),
        pubsub: gossipsub(),
        identify: identify(),
      },
    });
    heliaInstance = await createHelia({
      libp2p,
    });
    const serverMultiaddr = multiaddr(
      `/ip4/${serverIP}/tcp/4002/ws/p2p/${serverPeerID}`,
    );
    await heliaInstance.libp2p.dial(serverMultiaddr);
    unixFsInstance = unixfs(heliaInstance);
    console.log(libp2p);
    console.log(libp2p.getPeers());
    await checkDHTConnection();
    console.log("Helia is ready and connected to the custom IPFS server!");
  } catch (e) {
    console.error("Error connecting to the custom IPFS server:", e);
  }
}

export async function getInstance() {
  return { helia: heliaInstance, fs: unixFsInstance };
}

async function checkDHTConnection() {
  if (!heliaInstance) {
    console.log("⚠️ Helia instance is not initialized.");
    return;
  }
  const libp2p = heliaInstance.libp2p;
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
  const mode = await libp2p.services.dht.getMode();
  console.log(`📡 DHT Mode: ${mode}`);
}
