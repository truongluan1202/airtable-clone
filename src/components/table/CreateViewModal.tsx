import { useState, useRef, useEffect, useCallback } from "react";

interface CreateViewModalProps {
  onCreateView: (name: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function CreateViewModal({
  onCreateView,
  onClose,
  isLoading = false,
}: CreateViewModalProps) {
  // Draft state - never read from server while editing
  const [draftName, setDraftName] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Commit draft - save and close
  const handleCommit = useCallback(() => {
    if (draftName.trim() && !isComposing) {
      onCreateView(draftName.trim());
      onClose();
    } else {
      onClose();
    }
  }, [draftName, onCreateView, onClose, isComposing]);

  // Cancel draft - discard and close
  const handleCancel = useCallback(() => {
    setDraftName("");
    onClose();
  }, [onClose]);

  // Handle IME composition events
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  useEffect(() => {
    // Focus the input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleCommit();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCommit, handleCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCommit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter" && !isComposing) {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div className="cell-modal-overlay bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div
        ref={modalRef}
        className="w-96 rounded-lg bg-white p-6 shadow-xl"
        onKeyDown={handleKeyDown}
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Create New View
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              View Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onBlur={handleCommit}
              placeholder="Enter view name..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              required
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!draftName.trim() || isLoading}
              className="flex items-center space-x-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isLoading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent"></div>
                  <span>Creating...</span>
                </>
              ) : (
                "Create View"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
