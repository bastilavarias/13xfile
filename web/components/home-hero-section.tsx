import { ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomeHeroSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-10 md:mb-0 md:pr-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Fast, Secure P2P File Sharing
            </h1>
            <p className="text-lg md:text-xl mb-8 max-w-lg">
              <span className="font-semibold">13xFile</span> is a lightweight,
              open-source peer-to-peer client focused on speed, privacy, and
              simplicity. <br />
              Powered by{" "}
              <Link
                href="https://ipfs.tech/"
                target="_blank"
                className="hover:underline font-semibold"
              >
                IPFS Protocol
              </Link>
              .
            </p>
            <p className="text-lg md:text-xl mb-8 max-w-lg"></p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="px-6 py-6 text-lg">
                <Download className="mr-2 h-5 w-5" /> Download Now
              </Button>
              <Button variant="outline" className="c px-6 py-6 text-lg">
                Learn More <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
