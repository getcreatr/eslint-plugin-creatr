// lib/configs/nextjs-app-router.js
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
  },
};