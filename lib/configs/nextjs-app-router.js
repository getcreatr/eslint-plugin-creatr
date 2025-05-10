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
  },
};