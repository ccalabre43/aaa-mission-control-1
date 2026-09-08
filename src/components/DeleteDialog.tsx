type DeleteDialogProps = {
  projectName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteDialog({
  projectName,
  onCancel,
  onConfirm,
}: DeleteDialogProps) {
  const label = projectName.trim() || "this deliverable";

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="modal-box">
        <h2 id="delete-title" className="font-display text-xl">
          Delete deliverable?
        </h2>
        <p className="py-4">
          This removes <strong>{label}</strong> from the tracker on this device. You can
          export a copy first if you still need it in Excel.
        </p>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost min-h-11" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className="btn btn-primary min-h-11" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
      <button
        type="button"
        className="modal-backdrop bg-black/40"
        aria-label="Cancel delete"
        onClick={onCancel}
      />
    </div>
  );
}
