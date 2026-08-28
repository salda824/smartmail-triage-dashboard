import {
  AlertTriangle,
  Briefcase,
  CreditCard,
  Lightbulb,
  Newspaper,
  Package,
  Tag,
} from 'lucide-react';
import type { CategoryIcon as IconName } from '@/types/email';

const ICONS = {
  briefcase: Briefcase,
  alert: AlertTriangle,
  card: CreditCard,
  news: Newspaper,
  bulb: Lightbulb,
  tag: Tag,
  package: Package,
} as const;

/** Traduce el nombre de icono de la categoria al componente de lucide. */
export function CategoryIcon({
  name,
  size = 14,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon size={size} className={className} strokeWidth={2} />;
}
