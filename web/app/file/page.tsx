import ThemeProvider from "@/components/theme-provider";
import AppFooter from "@/components/app-footer";
import AppNavbar from "@/components/app-navbar";
import FileDetailsSection from "@/components/file-details-section";

export default function FilePage() {
  return (
    <ThemeProvider>
      <AppNavbar></AppNavbar>
      <div className="container py-20 md:py-28 space-y-10">
        <FileDetailsSection />
      </div>
    </ThemeProvider>
  );
}
