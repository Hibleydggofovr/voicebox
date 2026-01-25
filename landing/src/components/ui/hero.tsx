'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface HeroProps {
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  className?: string;
  showLogo?: boolean;
}

export function Hero({ title, description, actions, className, showLogo = true }: HeroProps) {
  return (
    <section className={cn('relative text-center pt-8 sm:pt-12 md:pt-14 -mb-6 sm:-mb-8 md:-mb-10 overflow-hidden -mx-4 sm:-mx-6 md:-mx-4 -mt-4 sm:mt-0 md:mt-0', className)}>
      <div className="relative z-10 px-4">
        {showLogo && (
          <div className="flex justify-center mb-4 sm:mb-6">
            <Image
              src="/voicebox-logo.png"
              alt="Voicebox Logo"
              width={1024}
              height={1024}
              className="w-32 sm:w-40 md:w-48 h-auto"
              priority
            />
          </div>
        )}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6">
          {title}
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-foreground/60 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
          {description}
        </p>
        {actions && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
