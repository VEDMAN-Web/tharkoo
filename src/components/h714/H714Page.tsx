import type { CSSProperties, ReactNode } from "react";
import "./h714.css";

export function H714Page({ children }: { children: ReactNode }) {
  return (
    <div className="h714" style={ROOT_STYLE}>
      {children}
    </div>
  );
}

const ROOT_STYLE: CSSProperties = { minHeight: "100vh", background: "radial-gradient(circle at 90% 4%, rgba(233,30,140,.14), transparent 30%), radial-gradient(circle at 2% 40%, rgba(124,58,237,.12), transparent 32%), #FDF6FB", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "#1E0B38" };
