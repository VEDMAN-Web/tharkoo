import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Saved contacts", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Saved contacts">
      <p>Ad title, nickname, city, channels, date. Delete confirm. Empty: no saved contacts yet + browse.</p><a href='/'>Browse</a>
    </Simple>
  );
}
