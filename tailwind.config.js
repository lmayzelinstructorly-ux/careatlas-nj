/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hb: {
          navy: "#003B66",
          deepNavy: "#002B4D",
          teal: "#009CA6",
          aqua: "#18C7C0",
          green: "#55B947",
          background: "#F5FAFB",
          card: "#FFFFFF",
          border: "#D6E8EB",
          text: "#102A43",
          muted: "#5B7180"
        }
      }
    }
  },
  plugins: []
};
