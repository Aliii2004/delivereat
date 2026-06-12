import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
  NormalizedCacheObject,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import Cookies from 'js-cookie';

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost/graphql';

function createApolloClient(): ApolloClient<NormalizedCacheObject> {
  const httpLink = createHttpLink({ uri: GRAPHQL_URL });

  const authLink = setContext((_, { headers }) => {
    // SSR da Cookies.get undefined qaytarishi mumkin — guard
    const token =
      typeof window !== 'undefined' ? Cookies.get('accessToken') : undefined;
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    };
  });

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }) => {
        console.error(`GraphQL error: ${message}`, { locations, path });
      });
    }
    if (networkError) {
      console.error('Network error:', networkError);
    }
  });

  return new ApolloClient({
    // SSR da ssrMode: true
    ssrMode: typeof window === 'undefined',
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            restaurantStats: { keyArgs: ['restaurantId', 'days'] },
            burndownChart:   { keyArgs: ['restaurantId', 'days'] },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      },
    },
  });
}

// Client tarafda singleton — server tarafda har doim yangi
let clientInstance: ApolloClient<NormalizedCacheObject> | null = null;

export function getApolloClient(): ApolloClient<NormalizedCacheObject> {
  if (typeof window === 'undefined') {
    // SSR — har request uchun yangi instance
    return createApolloClient();
  }
  // Browser — singleton
  if (!clientInstance) {
    clientInstance = createApolloClient();
  }
  return clientInstance;
}

// Backwards compat — Providers.tsx da ishlatiladi
export const apolloClient = getApolloClient();
