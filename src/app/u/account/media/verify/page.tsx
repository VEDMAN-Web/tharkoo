import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Photo verification", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Photo verification">
      <p>3 steps: portrait, steady, one person. Record 360° in browser. Preview, retake, submit.</p><button className='btn-post' type='button'>Submit</button>
    </Simple>
  );
}
