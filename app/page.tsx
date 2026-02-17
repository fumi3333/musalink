import { HeroSection } from "@/components/home/HeroSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { SustainabilitySection } from "@/components/home/SustainabilitySection";

// Note: Header is likely in RootLayout, so we just focus on Main Content
export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <HeroSection />
      <HowItWorks />
       <SustainabilitySection />
    </main>
  );
}
