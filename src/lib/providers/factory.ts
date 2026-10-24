import { DNSProviderAdapter, ProviderMetadata } from './types';
import { CloudflareAdapter } from './cloudflare';

const adapters: Record<string, DNSProviderAdapter> = {
  cloudflare: new CloudflareAdapter(),
};

export const PROVIDERS_METADATA: ProviderMetadata[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare DNS',
    description: 'Enterprise-grade global DNS with ultrafast propagation, DDoS protection, and proxy caching.',
    website: 'https://cloudflare.com',
    status: 'active',
    authFields: [
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        placeholder: 'Enter Cloudflare Scoped API Token',
        description: 'Scoped API token with Zone:Read and DNS:Edit permissions.',
        required: true,
      },
    ],
  },
  {
    id: 'duckdns',
    name: 'DuckDNS',
    description: 'Free dynamic DNS service hosted on AWS infrastructure with instant updates.',
    website: 'https://duckdns.org',
    status: 'coming_soon',
    authFields: [],
  },
  {
    id: 'noip',
    name: 'No-IP',
    description: 'Popular managed dynamic DNS provider with global anycast DNS network.',
    website: 'https://noip.com',
    status: 'coming_soon',
    authFields: [],
  },
  {
    id: 'dynu',
    name: 'Dynu Systems',
    description: 'Reliable free and paid Dynamic DNS service with extensive API options.',
    website: 'https://dynu.com',
    status: 'coming_soon',
    authFields: [],
  },
  {
    id: 'namecheap',
    name: 'Namecheap Dynamic DNS',
    description: 'Dynamic DNS client support for domains registered on Namecheap.',
    website: 'https://namecheap.com',
    status: 'coming_soon',
    authFields: [],
  },
  {
    id: 'gcp',
    name: 'Google Cloud DNS',
    description: 'High-availability, low-latency private and public DNS serving on Google Cloud.',
    website: 'https://cloud.google.com/dns',
    status: 'coming_soon',
    authFields: [],
  },
  {
    id: 'route53',
    name: 'AWS Route 53',
    description: 'Highly available and scalable cloud Domain Name System (DNS) web service.',
    website: 'https://aws.amazon.com/route53',
    status: 'coming_soon',
    authFields: [],
  },
  {
    id: 'custom',
    name: 'Custom Webhook / REST',
    description: 'Generic RFC 2136 / RESTful DNS update adapter for custom self-hosted nameservers.',
    website: '#',
    status: 'coming_soon',
    authFields: [],
  },
];

/**
 * Get active provider adapter instance. Throws error if provider is not supported or active.
 */
export function getProviderAdapter(providerId: string): DNSProviderAdapter {
  const adapter = adapters[providerId.toLowerCase()];
  if (!adapter) {
    throw new Error(`Provider "${providerId}" is not implemented or not active.`);
  }
  return adapter;
}

/**
 * Check if a provider is currently active.
 */
export function isProviderActive(providerId: string): boolean {
  return !!adapters[providerId.toLowerCase()];
}

/**
 * Get list of all providers with their active/coming_soon status.
 */
export function getAllProvidersMetadata(): ProviderMetadata[] {
  return PROVIDERS_METADATA;
}
