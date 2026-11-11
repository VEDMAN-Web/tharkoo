import { Camera, Check, Clock, Heart, Lock, MapPin, Phone, Search, Shield, Star, Zap } from "lucide-react";

const ICONS = {
  camera: Camera,
  check: Check,
  clock: Clock,
  heart: Heart,
  lock: Lock,
  "map-pin": MapPin,
  phone: Phone,
  search: Search,
  shield: Shield,
  star: Star,
  zap: Zap,
} as const;

export function BlockIcon({ name }: { name?: string }) {
  const Icon = ICONS[(name ?? "") as keyof typeof ICONS] ?? Check;
  return (
    <span className="tk-block-icon" aria-hidden>
      <Icon size={20} />
    </span>
  );
}
