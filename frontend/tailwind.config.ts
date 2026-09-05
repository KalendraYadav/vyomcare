import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        // Primary — a calibrated blue, not the default #3B82F6
        primary: {
          DEFAULT: "#1D4ED8",
          hover: "#1E40AF",
          subtle: "#EFF6FF",
        },
        // Status colors — semantic only (design.md §2.1)
        status: {
          success: "#16A34A",
          "success-bg": "#F0FDF4",
          pending: "#D97706",
          "pending-bg": "#FFFBEB",
          danger: "#DC2626",
          "danger-bg": "#FEF2F2",
          info: "#0284C7",
          "info-bg": "#F0F9FF",
        },
        // Severity
        severity: {
          low: "#16A34A",
          medium: "#D97706",
          high: "#DC2626",
        },
        // Neutrals
        neutral: {
          0: "#FFFFFF",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
        // Border
        border: {
          DEFAULT: "#E2E8F0",
          focus: "#1D4ED8",
        },
      },
      spacing: {
        // 4px base unit (design.md §2.3)
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        full: "9999px",
      },
      boxShadow: {
        none: "none",
        raised: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
        modal: "0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)",
        toast: "0 4px 16px rgba(0,0,0,0.12)",
      },
      fontSize: {
        // Type scale (design.md §2.2)
        display: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        "heading-lg": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "heading-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "heading-sm": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-em": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        label: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "400" }],
        numeric: ["20px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.01em" }],
        status: ["12px", { lineHeight: "16px", fontWeight: "600" }],
      },
      screens: {
        // Breakpoints (design.md §2.4 — 0/640/1024/1440)
        mobile: "0px",
        tablet: "640px",
        laptop: "1024px",
        desktop: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
