export default function ErrorMsg({ message }) {
  if (!message) return null;
  return (
    <div className="px-4 py-3 bg-error-container/20 border border-error/30 rounded-xl text-sm text-error">
      {message}
    </div>
  );
}
