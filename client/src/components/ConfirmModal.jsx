export default function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative glass-card rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-error-container/20 border border-error/30 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-error text-[20px]">
              delete
            </span>
          </div>
          <h2 className="font-display font-bold text-on-surface text-lg">
            {title}
          </h2>
        </div>
        <p className="text-sm text-on-surface-variant mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-error-container/20 border border-error/30 text-error rounded-xl text-sm font-bold hover:bg-error-container/40 transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
