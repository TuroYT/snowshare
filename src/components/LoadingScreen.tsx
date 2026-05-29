"use client";

export default function LoadingScreen() {
  return (
    <div
      className="flex justify-center items-center min-h-screen bg-[var(--background)] pointer-events-none"
      style={{ animation: "fadeOut 0.6s ease-out 2s forwards" }}
    >
      <svg
        className="animate-spin w-16 h-16 text-[var(--primary)]"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
