import { SkAccountFrame } from "@/components/ui/Sk";
import "@/components/buyer/user-panel.css";

/** Shown at once while any My account page is on its way: the menu and a page of grey shapes, then the real page replaces it. */
export default function Loading() {
  return <SkAccountFrame />;
}
