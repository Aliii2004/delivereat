import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Restaurant, MenuItem } from '@/types';

export const menuKeys = {
  restaurants: () => ['restaurants'] as const,
  restaurant: (id: string) => ['restaurants', id] as const,
  myRestaurant: () => ['my-restaurant'] as const,
  menu: (restaurantId: string) => ['menu', restaurantId] as const,
};

export function useRestaurants(page = 1) {
  return useQuery({
    queryKey: [...menuKeys.restaurants(), { page }],
    queryFn: () =>
      api.get<{ restaurants: Restaurant[]; pagination: unknown }>('/menu/restaurants', {
        params: { page, limit: 20 },
      }).then((r) => r.data),
    staleTime: 60 * 1000,
  });
}

export function useRestaurant(restaurantId: string) {
  return useQuery({
    queryKey: menuKeys.restaurant(restaurantId),
    queryFn: () =>
      api.get<{ restaurant: Restaurant }>(`/menu/restaurants/${restaurantId}`)
        .then((r) => r.data.restaurant),
    staleTime: 60 * 1000,
  });
}

export function useMyRestaurant() {
  return useQuery({
    queryKey: menuKeys.myRestaurant(),
    queryFn: () =>
      api.get<{ restaurant: Restaurant }>('/menu/my-restaurant')
        .then((r) => r.data.restaurant),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useMenu(restaurantId: string) {
  return useQuery({
    queryKey: menuKeys.menu(restaurantId),
    queryFn: () =>
      api.get<{ menuItems: MenuItem[] }>(`/menu/restaurants/${restaurantId}/menu`)
        .then((r) => r.data.menuItems),
    staleTime: 2 * 60 * 1000,
  });
}

