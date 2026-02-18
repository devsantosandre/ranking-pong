"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "@/lib/queries/query-keys";
import {
  fetchNewsPage,
  NEWS_GC_TIME_MS,
  NEWS_STALE_TIME_MS,
  type NewsPage,
} from "@/lib/queries/use-news";

function scheduleIdleTask(task: () => void) {
  const win = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (win.requestIdleCallback) {
    const handle = win.requestIdleCallback(task, { timeout: 1200 });
    return () => {
      if (win.cancelIdleCallback) {
        win.cancelIdleCallback(handle);
      }
    };
  }

  const handle = window.setTimeout(task, 300);
  return () => window.clearTimeout(handle);
}

export function usePrefetchNews(enabled: boolean) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      prefetchedRef.current = false;
      return;
    }

    if (prefetchedRef.current) {
      return;
    }

    prefetchedRef.current = true;

    const cancelIdleSchedule = scheduleIdleTask(() => {
      void queryClient.prefetchInfiniteQuery({
        queryKey: queryKeys.news.all,
        queryFn: ({ pageParam = 0 }) => fetchNewsPage(supabase, pageParam),
        getNextPageParam: (lastPage: NewsPage) => lastPage.nextPage,
        initialPageParam: 0,
        staleTime: NEWS_STALE_TIME_MS,
        gcTime: NEWS_GC_TIME_MS,
      });
    });

    return () => {
      cancelIdleSchedule();
    };
  }, [enabled, queryClient, supabase]);
}
