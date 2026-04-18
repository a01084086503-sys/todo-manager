import { cn } from "@/lib/utils"

// Skeleton 기능을 제공한다.
const Skeleton = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
};

export { Skeleton }
