"use client";

import { Loader2 } from "lucide-react";
import { Button } from "./button";

type LoadMoreButtonProps = {
  onClick: () => void;
  isLoading: boolean;
  hasMore: boolean;
  className?: string;
};

export function LoadMoreButton({
  onClick,
  isLoading,
  hasMore,
  className = "",
}: LoadMoreButtonProps) {
  if (!hasMore) return null;

  return (
    <div className={`flex justify-center py-4 ${className}`}>
      <Button
        variant="outline"
        onClick={onClick}
        disabled={isLoading}
        className="min-w-[140px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando...
          </>
        ) : (
          "Carregar mais"
        )}
      </Button>
    </div>
  );
}
