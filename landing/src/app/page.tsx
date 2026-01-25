'use client';

import Link from 'next/link';
import { Github, Zap, Cpu, Cloud, Shield, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hero } from '@/components/ui/hero';
import { Section, SectionTitle } from '@/components/ui/section';
import { Card, CardContent } from '@/components/ui/card';
import { FeatureCard } from '@/components/ui/feature-card';
import { DownloadSection } from '@/components/DownloadSection';
import { GITHUB_REPO } from '@/lib/constants';

export default function Home() {
  const features = [
    {
      title: 'Near-Perfect Voice Cloning',
      description: 'Powered by Alibaba\'s Qwen3-TTS model for exceptional voice quality and accuracy.',
      icon: <Zap className="h-6 w-6" />,
    },
    {
      title: 'Multi-Sample Support',
      description: 'Combine multiple voice samples for higher quality and more natural-sounding results.',
      icon: <Code className="h-6 w-6" />,
    },
    {
      title: 'Smart Caching',
      description: 'Instant re-generation with voice prompt caching. No need to reprocess samples.',
      icon: <Zap className="h-6 w-6" />,
    },
    {
      title: 'Local or Remote',
      description: 'Run GPU inference locally or connect to a remote machine. One-click server setup.',
      icon: <Cloud className="h-6 w-6" />,
    },
    {
      title: 'Production Ready',
      description: 'Type-safe, modular architecture. Desktop-first experience with native performance.',
      icon: <Shield className="h-6 w-6" />,
    },
    {
      title: 'Cross-Platform',
      description: 'Available for macOS, Windows, and Linux. No Python installation required.',
      icon: <Cpu className="h-6 w-6" />,
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 md:space-y-20">
      {/* Hero Section */}
      <Hero
        title="voicebox"
        description="Professional voice cloning powered by Qwen3-TTS. Create natural-sounding speech from text with near-perfect voice replication."
        actions={
          <>
            <Button asChild size="lg">
              <a href="#download">
                Download Now
              </a>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              asChild
            >
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-2" />
                View on GitHub
              </a>
            </Button>
          </>
        }
      />

      {/* Features Section */}
      <Section id="features">
        <SectionTitle className="mb-4 text-center">Features</SectionTitle>
        <p className="text-sm text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
          Everything you need for professional voice cloning in a desktop app.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
            />
          ))}
        </div>
      </Section>

      {/* Download Section */}
      <Section id="download">
        <SectionTitle className="mb-4 text-center">Download</SectionTitle>
        <p className="text-sm text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
          Available for macOS, Windows, and Linux. Choose your platform below.
        </p>
        <DownloadSection />
      </Section>
    </div>
  );
}
