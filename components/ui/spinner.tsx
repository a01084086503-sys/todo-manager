import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

// Spinner 기능을 제공한다.
const Spinner = ({ className, ...props }: React.ComponentProps<"svg">) => {
  return (
    <Loader2Icon role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
};

export { Spinner }
