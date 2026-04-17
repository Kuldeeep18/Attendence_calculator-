'use strict';

const dns = require('node:dns');

const PUBLIC_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

let fallbackInstalled = false;

function isSupabaseHost(hostname) {
  return (
    typeof hostname === 'string' &&
    /(?:^|\.)supabase\.(co|in|red)$/i.test(hostname)
  );
}

function installSupabaseDnsFallback() {
  if (fallbackInstalled) {
    return;
  }

  const originalLookup = dns.lookup.bind(dns);
  const resolver = new dns.Resolver();
  resolver.setServers(PUBLIC_DNS_SERVERS);

  dns.lookup = function lookupWithFallback(hostname, options, callback) {
    let lookupOptions = options;
    let cb = callback;

    if (typeof lookupOptions === 'function') {
      cb = lookupOptions;
      lookupOptions = undefined;
    }

    const callOriginalLookup = (lookupCallback) => {
      if (lookupOptions === undefined) {
        return originalLookup(hostname, lookupCallback);
      }

      return originalLookup(hostname, lookupOptions, lookupCallback);
    };

    if (typeof cb !== 'function') {
      return callOriginalLookup();
    }

    if (!isSupabaseHost(hostname)) {
      return callOriginalLookup(cb);
    }

    const fallbackLookup = () => {
      const wantsV4 =
        !lookupOptions ||
        typeof lookupOptions !== 'object' ||
        lookupOptions.family !== 6;
      const wantsV6 =
        !lookupOptions ||
        typeof lookupOptions !== 'object' ||
        lookupOptions.family !== 4;
      const wantsAll = Boolean(
        lookupOptions && typeof lookupOptions === 'object' && lookupOptions.all
      );

      const returnAddress = (address, family) => {
        if (wantsAll) {
          cb(null, [{ address, family }]);
          return;
        }

        cb(null, address, family);
      };

      const fallbackError = new Error(
        `Unable to resolve ${hostname} through system and fallback DNS.`
      );
      fallbackError.code = 'ENOTFOUND';

      const resolveV6 = (v4Error) => {
        if (!wantsV6) {
          cb(v4Error || fallbackError);
          return;
        }

        resolver.resolve6(hostname, (v6Error, ipv6Addresses) => {
          if (!v6Error && Array.isArray(ipv6Addresses) && ipv6Addresses.length > 0) {
            returnAddress(ipv6Addresses[0], 6);
            return;
          }

          cb(v6Error || v4Error || fallbackError);
        });
      };

      if (!wantsV4) {
        resolveV6();
        return;
      }

      resolver.resolve4(hostname, (v4Error, ipv4Addresses) => {
        if (!v4Error && Array.isArray(ipv4Addresses) && ipv4Addresses.length > 0) {
          returnAddress(ipv4Addresses[0], 4);
          return;
        }

        resolveV6(v4Error);
      });
    };

    return callOriginalLookup((error, address, family) => {
      if (!error) {
        cb(null, address, family);
        return;
      }

      if (!['ENOTFOUND', 'EAI_AGAIN'].includes(error.code)) {
        cb(error, address, family);
        return;
      }

      fallbackLookup();
    });
  };

  fallbackInstalled = true;
}

module.exports = {
  installSupabaseDnsFallback
};
