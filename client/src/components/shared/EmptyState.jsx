export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 border border-outline-variant">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">ballot</span>
      </div>
      <h3 className="font-display font-semibold text-on-surface mb-1">{title}</h3>
      {description && <p className="text-sm text-on-surface-variant mb-4">{description}</p>}
      {action}
    </div>
  );
}
