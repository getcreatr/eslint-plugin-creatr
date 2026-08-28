'use strict';

module.exports = {
  plugins: ['creatr'],
  rules: {
    'creatr/require-use-client': ['error', {
      libraries: [
        'framer-motion',
        'react-spring',
        '@dnd-kit/core',
        'swiper',
        'embla-carousel-react',
        'motion/react'
      ],
      hooks: [
        'useSearchParams',
        'useRouter',
        'usePathname',
        'useParams',
      ],
      checkEventHandlers: true,
    }],
    'creatr/no-browser-globals-in-ssr': ['error', {
      allowInClientComponents: false,
      allowInEffects: true,
      allowInEventHandlers: true,
      allowWithTypeCheck: true,
    }],
    'creatr/no-metadata-in-client-components': 'error',
    'creatr/no-event-handlers-in-server-components': 'error',
    'creatr/no-parallel-page-routes': 'error',
    'creatr/no-server-components-in-client': 'error',
    'creatr/no-pages-router-imports-in-app': 'error',
    'creatr/no-hardcoded-redirect-urls': 'error',
    'creatr/no-router-in-server-components': 'error',
    'creatr/require-server-action-metadata': 'error',
    'creatr/no-invalid-next-routes': ['error', { appDir: 'src/app' }],
    'creatr/no-raw-img-element': 'error',
    'creatr/no-imperative-navigation': 'error',
  },
};