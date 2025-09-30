import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

interface UserDropdownProps {
  className?: string;
  position?: "top-right" | "bottom-left" | "bottom-right";
}

export function UserDropdown({
  className = "",
  position = "top-right",
}: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = () => {
    void signOut({ callbackUrl: "/auth/signin" });
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#37c9ff] transition-colors hover:bg-blue-400"
      >
        <span className="text-sm text-black">
          {session?.user?.name?.charAt(0) ?? "U"}
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-64 rounded-md border border-gray-200 bg-white py-1 shadow-lg ${
            position === "bottom-left"
              ? "bottom-10 left-0"
              : position === "bottom-right"
                ? "right-0 bottom-10"
                : "top-10 right-0"
          }`}
        >
          {/* User Info */}
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                <span className="text-sm text-white">
                  {session?.user?.name?.charAt(0) ?? "U"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-900">
                  {session?.user?.name ?? "User"}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {session?.user?.email ?? "user@example.com"}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              Account settings
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              Billing
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              Help & support
            </button>
            <div className="my-1 border-t border-gray-100"></div>
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
