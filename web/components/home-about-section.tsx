import {
  Shield,
  Zap,
  Code,
  Download,
  Apple,
  ComputerIcon as Windows,
  LaptopIcon as Linux,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomeAboutSection() {
  return (
    <section id="about" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">About 13xFile</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A modern peer-to-peer file sharing application designed with
            simplicity, performance, and privacy in mind.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="bg-black dark:bg-white rounded-full w-12 h-12 flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-white dark:text-black" />
            </div>
            <h3 className="text-xl font-bold mb-3">Lightning Fast</h3>
            <p className="text-muted-foreground">
              Optimized for speed with a lightweight codebase and efficient
              networking protocols that maximize your bandwidth.
            </p>
          </div>

          <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="bg-black dark:bg-white rounded-full w-12 h-12 flex items-center justify-center mb-6">
              <Shield className="h-6 w-6 text-white dark:text-black" />
            </div>
            <h3 className="text-xl font-bold mb-3">Privacy Focused</h3>
            <p className="text-muted-foreground">
              Built with privacy at its core, featuring encrypted connections
              and no tracking or data collection.
            </p>
          </div>

          <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="bg-black dark:bg-white rounded-full w-12 h-12 flex items-center justify-center mb-6">
              <Code className="h-6 w-6 text-white dark:text-black" />
            </div>
            <h3 className="text-xl font-bold mb-3">Open Source</h3>
            <p className="text-muted-foreground">
              Fully open-source and community-driven, ensuring transparency and
              continuous improvement.
            </p>
          </div>
        </div>

        <div className="mt-16 p-8 md:p-12 rounded-xl border space-y-10">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-2/3 mb-8 md:mb-0 md:pr-10">
              <h3 className="text-2xl font-bold mb-4">
                Cross-Platform Compatibility
              </h3>
              <p className="text-muted-foreground mb-4">
                13xFile runs seamlessly on all major operating systems,
                providing the same great experience whether you're on Windows,
                macOS, or Linux.
              </p>
              <p className="text-muted-foreground">
                Our application is built using modern technologies that ensure
                consistent performance and reliability across all platforms,
                with native integrations for each operating system.
              </p>
            </div>
            <div className="md:w-1/3 flex justify-center">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border flex items-center justify-center">
                  <svg
                    className="h-10 w-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M22 17.5L12 22L2 17.5V6.5L12 2L22 6.5V17.5Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 22V12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 6.5L12 12L2 6.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M17 4L7 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="p-4 rounded-lg border flex items-center justify-center">
                  <svg
                    className="h-10 w-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="p-4 rounded-lg border flex items-center justify-center">
                  <svg
                    className="h-10 w-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21 16V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18H19C20.1046 18 21 17.1046 21 16Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 22H17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 18V22"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
              <Windows className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Windows</h3>
              <p className="mb-4 text-sm">Windows 10, 11 (64-bit)</p>
              <Button className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
              <Apple className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">macOS</h3>
              <p className="mb-4 text-sm">macOS 11+ (Intel & Apple Silicon)</p>
              <Button className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
              <Linux className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Linux</h3>
              <p className="mb-4 text-sm">Ubuntu, Debian, Fedora, Arch</p>
              <Button className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>
          </div>

          <div className="p-8 rounded-xl">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-4">Source Code</h3>

              <p className="mb-6">
                13xFile is open source and available on GitHub. Developers are
                welcome to contribute to the project.
              </p>
              <div className="flex justify-center">
                <Button variant="outline">
                  <svg
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2C6.477 2 2 6.477 2 12C2 16.418 4.865 20.166 8.84 21.49C9.34 21.58 9.52 21.27 9.52 21C9.52 20.77 9.51 20.14 9.51 19.31C6.73 19.91 6.14 17.97 6.14 17.97C5.68 16.81 5.03 16.5 5.03 16.5C4.12 15.88 5.1 15.9 5.1 15.9C6.1 15.97 6.63 16.93 6.63 16.93C7.5 18.45 8.97 18 9.54 17.76C9.63 17.11 9.89 16.67 10.17 16.42C7.95 16.17 5.62 15.31 5.62 11.5C5.62 10.39 6 9.5 6.65 8.79C6.55 8.54 6.2 7.5 6.75 6.15C6.75 6.15 7.59 5.88 9.5 7.17C10.29 6.95 11.15 6.84 12 6.84C12.85 6.84 13.71 6.95 14.5 7.17C16.41 5.88 17.25 6.15 17.25 6.15C17.8 7.5 17.45 8.54 17.35 8.79C18 9.5 18.38 10.39 18.38 11.5C18.38 15.32 16.04 16.16 13.81 16.41C14.17 16.72 14.5 17.33 14.5 18.26C14.5 19.6 14.49 20.68 14.49 21C14.49 21.27 14.67 21.59 15.17 21.49C19.14 20.16 22 16.42 22 12C22 6.477 17.523 2 12 2Z"
                      fill="currentColor"
                    />
                  </svg>
                  View on GitHub
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
