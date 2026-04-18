"use client"

import { AspectRatio as AspectRatioPrimitive } from "radix-ui"

// AspectRatio 기능을 제공한다.
const AspectRatio = ({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitive.Root>) => {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />
};

export { AspectRatio }
