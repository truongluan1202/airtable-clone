import { useState, useCallback, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { EditableCellProps } from "./types";

export const EditableCell = memo(function EditableCell({
  value,
  onUpdate,
  isEditing,
  onStartEdit,
  onStopEdit,
  onSelect,
  placeholder,
  hasDropdown = false,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
  const [isDoubleClick, setIsDoubleClick] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [modalEditValue, setModalEditValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  // Sync editValue with value when not editing - guarded to prevent loops
  useEffect(() => {
    if (!isEditing && editValue !== value) {
      setEditValue(value);
    }
  }, [value, isEditing, editValue]);

  // Sync modal edit value when modal opens
  useEffect(() => {
    if (showFullContent) {
      setModalEditValue(value);
      setIsEditingInModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFullContent]); // Remove value dependency to prevent infinite loops

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showFullContent) {
        setShowFullContent(false);
      }
    };

    if (showFullContent) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [showFullContent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onUpdate(editValue);
        // Simply stop editing, don't move to next cell
        onStopEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditValue(value);
        onStopEdit();
      } else if (e.key === "Tab") {
        // Let the parent handle Tab navigation
        // Don't prevent default or stop propagation
        // The parent will handle saving and navigation
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        // Allow arrow keys to work normally within the input
        // Don't prevent default - let user navigate within the text
      }
    },
    [editValue, onUpdate, onStopEdit, value],
  );

  const handleBlur = useCallback(() => {
    onUpdate(editValue);
    onStopEdit();
  }, [editValue, onUpdate, onStopEdit]);

  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`w-full text-xs focus:outline-none ${
            hasDropdown ? "pr-6" : ""
          }`}
          placeholder={placeholder}
          autoFocus
        />
        {hasDropdown && (
          <Image
            src="/icons/chevron-down.svg"
            alt="Dropdown"
            width={12}
            height={12}
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-gray-400"
          />
        )}
      </div>
    );
  }

  const handleClick = (_e: React.MouseEvent) => {
    // Prevent single click if this is part of a double-click
    if (isDoubleClick) {
      setIsDoubleClick(false);
      return;
    }

    // Small delay to check if double-click follows
    setTimeout(() => {
      if (!isDoubleClick && !isEditing) {
        onSelect();
        // Show full content if there's any content
        if (value && value.length > 0) {
          setShowFullContent(true);
        }
      }
    }, 150); // Slightly longer delay to be more reliable
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDoubleClick(true);
    if (!isEditing) {
      onStartEdit();
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (value && value.length > 0) {
      setShowFullContent(true);
    }
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the cell click from firing
    if (value && value.length > 0) {
      setShowFullContent(true);
    }
  };

  const handleModalEdit = () => {
    setIsEditingInModal(true);
  };

  const handleModalSave = () => {
    onUpdate(modalEditValue);
    setIsEditingInModal(false);
    setShowFullContent(false);
  };

  const handleModalCancel = () => {
    setModalEditValue(value); // Reset to original value
    setIsEditingInModal(false);
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleModalCancel();
    } else if (e.key === "Enter") {
      // Only stop propagation to prevent parent handlers, but allow textarea default behavior
      e.stopPropagation();
      // Don't prevent default - let textarea handle Enter naturally
    }
  };

  return (
    <>
      <div
        ref={cellRef}
        className={`cursor-pointer rounded p-1 text-xs text-gray-900 hover:bg-gray-50`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          userSelect: "none",
          maxWidth: "100%",
        }}
        title={value || ""} // Show full content on hover
      >
        <div className="relative flex items-center gap-1">
          <span
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              maxWidth:
                value && value.length > 0 && isHovered
                  ? "calc(100% - 24px)"
                  : "100%",
            }}
          >
            {value || "-"}
          </span>
          {value && value.length > 0 && isHovered && (
            <span
              className="absolute -right-3 flex-shrink-0 cursor-pointer rounded px-1 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-800"
              onClick={handleIconClick}
              title="Click to view full content"
            >
              <Image
                src="/icons/expand-icon.svg"
                alt="expand"
                width={12}
                height={12}
              />
            </span>
          )}
        </div>
      </div>

      {/* Full Content Modal */}
      {showFullContent &&
        createPortal(
          <div
            className="cell-modal-overlay bg-opacity-10 flex items-center justify-center bg-black"
            onClick={() => {
              setShowFullContent(false);
            }}
            onKeyDown={(e) => {
              // Prevent any keyboard events from bubbling up
              e.stopPropagation();
            }}
          >
            <div
              className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                // Prevent keyboard events from bubbling up to parent elements
                e.stopPropagation();
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg text-gray-900">Cell Content</h3>
                <button
                  onClick={() => setShowFullContent(false)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="mb-4">
                {isEditingInModal ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">
                      Press Enter for new lines. Click Save to save changes.
                    </div>
                    <div className="rounded-md border border-blue-500 bg-white p-4">
                      <textarea
                        value={modalEditValue}
                        onChange={(e) => setModalEditValue(e.target.value)}
                        onKeyDown={handleModalKeyDown}
                        className="w-full resize-y border-none p-0 text-xs text-gray-900 focus:outline-none"
                        rows={Math.max(4, modalEditValue.split("\n").length)}
                        placeholder={placeholder}
                        autoFocus
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                    <pre className="text-xs whitespace-pre-wrap text-gray-900">
                      {value || "-"}
                    </pre>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                {isEditingInModal ? (
                  <>
                    <button
                      onClick={handleModalCancel}
                      className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleModalSave}
                      className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowFullContent(false)}
                      className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleModalEdit}
                      className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
});
