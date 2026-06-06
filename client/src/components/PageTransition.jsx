import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function PageTransition({ children }) {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      {children}
    </div>
  );
}
