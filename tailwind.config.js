/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#1C1C1E',
                surface: '#2C2C2E',
                surfaceHover: '#3A3A3C',
                bloodRed: '#FF003F',
                neonGreen: '#00FF66',
                primaryText: '#FFFFFF',
                secondaryText: '#A1A1AA',
                borderColor: '#3F3F46',
            },
            fontFamily: {
                sans: ['Space Grotesk', 'Lexend', 'Inter', 'sans-serif'],
            },
            borderRadius: {
                'lg': '12px',
                'xl': '16px',
            },
        }
    },
    plugins: [],
}
