/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07080d",
        shell: "#11141c",
        tide: "#1d2230",
        pulse: "#6ae3ff",
        coral: "#ff7657",
        mist: "#8894b2"
      },
      boxShadow: {
        glow: "0 0 40px rgba(106, 227, 255, 0.25)"
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Manrope", "sans-serif"]
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        pulsebar: "pulsebar 1.2s ease-in-out infinite"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" }
        },
        pulsebar: {
          "0%, 100%": { transform: "scaleY(0.35)", opacity: "0.45" },
          "50%": { transform: "scaleY(1)", opacity: "1" }
        }
      }
    }
  },
  plugins: []
};
