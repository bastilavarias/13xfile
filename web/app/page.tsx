import Navbar from "@/components/navbar";
import ThemeProvider from "@/components/theme-provider";
import HomeHeroSection from "@/components/home-hero-section";
import HomeAboutSection from "@/components/home-about-section";

export default function HomePage() {
  return (
    <ThemeProvider>
      <Navbar />
      <div>
        <HomeHeroSection />
        <HomeAboutSection />
      </div>
    </ThemeProvider>
  );
}
