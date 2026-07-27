import {
  Award,
  Bell,
  BellRing,
  Bookmark,
  Cake,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Gift,
  Globe,
  Heart,
  Layers,
  ListChecks,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  PartyPopper,
  PawPrint,
  Phone,
  Repeat,
  Rocket,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  ThumbsUp,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons can't live in Mongo — a component isn't serializable. The admin stores
 * the *name* string and every renderer looks it up here, in a statically
 * imported allowlist, so the bundler still sees real imports (a dynamic
 * `lucide-react/${name}` would defeat tree-shaking and ship the whole set).
 *
 * Adding an icon to the picker = adding one line to this object.
 */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Award,
  Bell,
  BellRing,
  Bookmark,
  Cake,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Gift,
  Globe,
  Heart,
  Layers,
  ListChecks,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  PartyPopper,
  PawPrint,
  Phone,
  Repeat,
  Rocket,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  ThumbsUp,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
};

export const ICON_NAMES = Object.keys(ICON_REGISTRY);

/** The icon for a stored name, falling back to a neutral one for unknowns. */
export function iconFor(name: string | undefined | null): LucideIcon {
  return (name && ICON_REGISTRY[name]) || Sparkles;
}

export function isKnownIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_REGISTRY, name);
}
