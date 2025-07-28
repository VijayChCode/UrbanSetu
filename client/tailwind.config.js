/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'slide-out-right': 'slideOutRight 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19) both',
        'backdrop-blur-in': 'backdropBlurIn 0.3s ease-out both',
        'backdrop-blur-out': 'backdropBlurOut 0.3s ease-in both',
        'menu-item-in': 'menuItemIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'hamburger-to-x': 'hamburgerToX 0.3s ease-in-out both',
        'x-to-hamburger': 'xToHamburger 0.3s ease-in-out both',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        'slideInRight': {
          '0%': { 
            opacity: '0', 
            transform: 'translateX(100%)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateX(0)' 
          },
        },
        'slideOutRight': {
          '0%': { 
            opacity: '1', 
            transform: 'translateX(0)' 
          },
          '100%': { 
            opacity: '0', 
            transform: 'translateX(100%)' 
          },
        },
        'backdropBlurIn': {
          '0%': { 
            'backdrop-filter': 'blur(0px)',
            'background-color': 'rgba(0, 0, 0, 0)'
          },
          '100%': { 
            'backdrop-filter': 'blur(8px)',
            'background-color': 'rgba(0, 0, 0, 0.6)'
          },
        },
        'backdropBlurOut': {
          '0%': { 
            'backdrop-filter': 'blur(8px)',
            'background-color': 'rgba(0, 0, 0, 0.6)'
          },
          '100%': { 
            'backdrop-filter': 'blur(0px)',
            'background-color': 'rgba(0, 0, 0, 0)'
          },
        },
        'menuItemIn': {
          '0%': { 
            opacity: '0', 
            transform: 'translateX(20px) scale(0.95)'
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateX(0) scale(1)'
          },
        },
        'hamburgerToX': {
          '0%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(90deg)' },
          '100%': { transform: 'rotate(180deg)' },
        },
        'xToHamburger': {
          '0%': { transform: 'rotate(180deg)' },
          '50%': { transform: 'rotate(90deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
      },
    },
  },
  plugins: [],
}
