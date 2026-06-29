import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const version = process.env.npm_package_version || 'unknown'

export default defineConfig({
    base: process.env.URL_BASE_PATH || '/',

    plugins: [
        react(),

        legacy({
            targets: ['Edge >= 18'],
            modernPolyfills: true,
            renderLegacyChunks: true,
        }),

        VitePWA({
            registerType: 'autoUpdate',

            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,webp,svg}'],
                cleanupOutdatedCaches: true,
                skipWaiting: true,
                clientsClaim: true,
            },

            manifest: {
                name: '𝓙𝓮𝓵𝓵𝔂•Music🗿',
                short_name: 'JellyMusic🗿',
                description: '𝓙𝓮𝓵𝓵𝔂𝓯𝓲𝓷',

                lang: 'de',

                id: 'https://heyfordy.dev/radio',
                start_url: 'https://heyfordy.dev/radio/',

                scope: '/',

                display: 'standalone',
                orientation: 'portrait',

                background_color: '#f8f8f8',
                theme_color: '#f8f8f8',

                icons: [
                    {
                        src: './web-app-manifest-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: './web-app-manifest-256x256.png',
                        sizes: '256x256',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: './web-app-manifest-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: './web-app-manifest-otherOS-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: './web-app-manifest-otherOS-256x256.png',
                        sizes: '256x256',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: './web-app-manifest-otherOS-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                ],
            },
        }),

        {
            name: 'html-version-injector',

            transformIndexHtml(html) {
                return html.replace('__VERSION__', version)
            },
        },
    ],

    build: {
        target: 'es2017',
    },

    define: {
        __NPM_LIFECYCLE_EVENT__: JSON.stringify(process.env.npm_lifecycle_event),
        __VERSION__: JSON.stringify(version),
    },
})