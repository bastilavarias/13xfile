import Link from "next/link";
import { Github, Twitter, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppFooter({ className }: { className?: string }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn([
        "bg-gray-50 dark:bg-gray-950 py-12 border-t border-gray-200 dark:border-gray-800",
        className,
      ])}
    >
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-black dark:text-white mb-4">
              13xFile
            </h3>
            <p className="text-muted-foreground text-sm">
              A modern, open-source peer-to-peer file sharing application
              focused on speed, privacy, and simplicity.
            </p>
          </div>

          {/*<div>*/}
          {/*  <h3 className="font-bold text-black dark:text-white mb-4">*/}
          {/*    Resources*/}
          {/*  </h3>*/}
          {/*  <ul className="space-y-2 text-sm">*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        Documentation*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        API Reference*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        Tutorials*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        FAQ*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*  </ul>*/}
          {/*</div>*/}

          {/*<div>*/}
          {/*  <h3 className="font-bold text-black dark:text-white mb-4">*/}
          {/*    Community*/}
          {/*  </h3>*/}
          {/*  <ul className="space-y-2 text-sm">*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        GitHub*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        Discord*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        Forum*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        Contributing*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*  </ul>*/}
          {/*</div>*/}

          {/*<div>*/}
          {/*  <h3 className="font-bold text-black dark:text-white mb-4">Legal</h3>*/}
          {/*  <ul className="space-y-2 text-sm">*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        Privacy Policy*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        Terms of Service*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*    <li>*/}
          {/*      <Link*/}
          {/*        href="#"*/}
          {/*        className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"*/}
          {/*      >*/}
          {/*        License*/}
          {/*      </Link>*/}
          {/*    </li>*/}
          {/*  </ul>*/}
          {/*</div>*/}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-muted-foreground text-sm mb-4 md:mb-0">
            © {currentYear} 13xFile. All rights reserved.
          </p>

          <div className="flex space-x-4">
            <Link
              href="#"
              className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </Link>
            <Link
              href="#"
              className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"
            >
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </Link>
            <Link
              href="#"
              className="text-muted-foreground hover:text-black dark:hover:text-white transition-colors"
            >
              <Mail className="h-5 w-5" />
              <span className="sr-only">Email</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
