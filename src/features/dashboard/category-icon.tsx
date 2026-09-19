import {
  Car,
  CircleDashed,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  PiggyBank,
  Shirt,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Los nombres de ícono que guarda la tabla `categories` (ver supabase/seed.sql). */
const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  laptop: Laptop,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  home: House,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  car: Car,
  zap: Zap,
  'heart-pulse': HeartPulse,
  clapperboard: Clapperboard,
  'graduation-cap': GraduationCap,
  shirt: Shirt,
  'circle-dashed': CircleDashed,
}

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || CircleDashed
  return <Icon className={className} strokeWidth={1.75} aria-hidden />
}
