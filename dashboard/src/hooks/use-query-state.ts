'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type QueryValue = string | number | undefined | null;
type QueryState = Record<string, QueryValue>;

export function useQueryState<T extends QueryState>(defaultValues: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(() => {
    const result = { ...defaultValues } as T;
    for (const key of Object.keys(defaultValues)) {
      const value = searchParams.get(key);
      if (value !== null) {
        const defaultValue = defaultValues[key];
        if (typeof defaultValue === 'number') {
          result[key as keyof T] = parseInt(value, 10) as T[keyof T];
        } else {
          result[key as keyof T] = value as T[keyof T];
        }
      }
    }
    return result;
  }, [searchParams, defaultValues]);

  const setState = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '' || value === defaultValues[key]) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(url, { scroll: false });
    },
    [router, pathname, searchParams, defaultValues]
  );

  const resetState = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return [state, setState, resetState] as const;
}

export function useQueryParam<T extends string | number>(
  key: string,
  defaultValue: T
): [T, (value: T | undefined) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = useMemo(() => {
    const param = searchParams.get(key);
    if (param === null) return defaultValue;
    if (typeof defaultValue === 'number') {
      return parseInt(param, 10) as T;
    }
    return param as T;
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: T | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue === undefined || newValue === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, String(newValue));
      }
      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(url, { scroll: false });
    },
    [router, pathname, searchParams, key, defaultValue]
  );

  return [value, setValue];
}
