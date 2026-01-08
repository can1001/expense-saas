declare module 'next-pwa' {
  import { NextConfig } from 'next';

  interface RuntimeCachingOptions {
    cacheName?: string;
    expiration?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
    };
    networkTimeoutSeconds?: number;
    cacheableResponse?: {
      statuses?: number[];
    };
  }

  interface RuntimeCaching {
    urlPattern: RegExp | string;
    handler: 'CacheFirst' | 'CacheOnly' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate';
    options?: RuntimeCachingOptions;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  }

  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    skipWaiting?: boolean;
    runtimeCaching?: RuntimeCaching[];
    publicExcludes?: string[];
    buildExcludes?: (string | RegExp)[];
    fallbacks?: {
      document?: string;
      image?: string;
      font?: string;
      audio?: string;
      video?: string;
    };
    cacheOnFrontEndNav?: boolean;
    reloadOnOnline?: boolean;
    customWorkerDir?: string;
    customWorkerSrc?: string;
  }

  function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export default withPWAInit;
}
