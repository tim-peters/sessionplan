import 'react';

// Lowercase HTML attributes the app sets directly: React 18 passes them through
// to the DOM and react-helmet-async to the head, but its types don't know them.
declare module 'react' {
  interface ImgHTMLAttributes<T> {
    fetchpriority?: 'high' | 'low' | 'auto';
  }
  interface LinkHTMLAttributes<T> {
    hreflang?: string;
  }
}
