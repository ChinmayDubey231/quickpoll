// Reusable logo mark — three stepped result bars on the brand orange.
// Decorative: every usage sits beside the "QuickPoll" wordmark, which carries the name.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#FF5B1F"/>
      <rect x="6" y="6.5" width="16" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="12.5" width="11" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="18.5" width="7" height="3" rx="1.5" fill="white"/>
    </svg>
  );
}
