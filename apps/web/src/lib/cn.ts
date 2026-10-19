import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge yang mengenali skala font Stitch agar `text-body-sm` tidak bentrok dengan warna. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'headline-xl', 'headline-xl-mobile', 'headline-lg', 'headline-lg-mobile',
            'headline-md', 'headline-sm', 'body-lg', 'body-md', 'body-sm',
            'label-md', 'label-sm', 'code-inline',
          ],
        },
      ],
      shadow: [{ shadow: ['level-1', 'level-2', 'level-3', 'chrome', 'modal'] }],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
