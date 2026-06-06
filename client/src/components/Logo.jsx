// Reusable logo mark — bar chart with live dot
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#7C4DFF"/>
      <rect x="5" y="18" width="5" height="9" rx="1.5" fill="white" opacity="0.6"/>
      <rect x="13.5" y="12" width="5" height="15" rx="1.5" fill="white" opacity="0.85"/>
      <rect x="22" y="6" width="5" height="21" rx="1.5" fill="white"/>
      <circle cx="26" cy="5" r="4" fill="#44ddc1"/>
      <circle cx="26" cy="5" r="2" fill="white"/>
    </svg>
  );
}
