"use client";

import { CircularProgress, Box } from "@mui/material";
import { keyframes } from "@mui/system";

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

export default function LoadingScreen() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        animation: `${fadeOut} 0.6s ease-out 2s forwards`,
        pointerEvents: "none",
      }}
    >
      <CircularProgress
        size={60}
        sx={{
          color: "var(--primary-color, #3B82F6)",
        }}
      />
    </Box>
  );
}
