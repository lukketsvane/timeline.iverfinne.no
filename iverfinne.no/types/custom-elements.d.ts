import * as React from 'react';

// React 19 resolves JSX.IntrinsicElements from the `react` module (not the
// global JSX namespace), so the <model-viewer> custom element is declared via
// module augmentation. Attributes cover what the site actually sets.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        poster?: string;
        autoplay?: boolean;
        'auto-rotate'?: boolean;
        'camera-controls'?: boolean;
        'camera-orbit'?: string;
        'min-camera-orbit'?: string;
        'max-camera-orbit'?: string;
        'environment-image'?: string;
        'tone-mapping'?: string;
        exposure?: string;
        'touch-action'?: string;
        'shadow-intensity'?: string;
        'interaction-prompt'?: string;
      };
    }
  }
}
