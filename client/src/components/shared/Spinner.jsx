export default function Spinner({ className = '' }) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className="w-6 h-6 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
    </div>
  );
}
