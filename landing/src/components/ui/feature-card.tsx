import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}

export function FeatureCard({ title, description, icon, className }: FeatureCardProps) {
  return (
    <Card className={cn('text-center hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1', className)}>
      <CardHeader>
        {icon && (
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-xl bg-muted/50 backdrop-blur-sm border border-border">
              {icon}
            </div>
          </div>
        )}
        <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm sm:text-base">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
