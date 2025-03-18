import ThemeProvider from "@/components/theme-provider";
import AppNavbar from "@/components/app-navbar";
import FileDetailsSection from "@/components/file-details-section";

export default function FilePage() {
  return (
    <ThemeProvider>
      <AppNavbar></AppNavbar>
      <section className="container py-10 md:py-12 lg:py-14 xl:py-16 space-y-10">
        <FileDetailsSection />
      </section>
    </ThemeProvider>
  );
}
