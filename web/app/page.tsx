import AppNavbar from "@/components/app-navbar";
import ThemeProvider from "@/components/theme-provider";
import HomeHeroSection from "@/components/home-hero-section";
import HomeAboutSection from "@/components/home-about-section";
import AppFooter from "@/components/app-footer";

export default function HomePage() {
  return (
    <ThemeProvider>
      <AppNavbar></AppNavbar>
      <div>
        <HomeHeroSection />
        <HomeAboutSection />
      </div>
      <AppFooter />
    </ThemeProvider>
  );
}
