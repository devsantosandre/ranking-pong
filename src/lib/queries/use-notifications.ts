"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import {
  getCurrentUserPendingConfirmationStatusAction,
  type CurrentUserPendingConfirmationStatus,
} from "@/app/actions/pending-confirmation";

const EMPTY_PENDING_CONFIRMATION_STATUS: CurrentUserPendingConfirmationStatus = {
  pendingActionsCount: 0,
  nextDeadlineAt: null,
  deadlineHours: 6,
};

export function usePendingConfirmationStatus(userId?: string) {
  return useQuery({
    queryKey: queryKeys.matches.pendingStatus(userId || "anonymous"),
    queryFn: async () => {
      if (!userId) {
        return EMPTY_PENDING_CONFIRMATION_STATUS;
      }

      return getCurrentUserPendingConfirmationStatusAction();
    },
    enabled: !!userId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePendingActionCount(userId?: string) {
  const statusQuery = usePendingConfirmationStatus(userId);

  return {
    ...statusQuery,
    data: statusQuery.data?.pendingActionsCount ?? 0,
  };
}
