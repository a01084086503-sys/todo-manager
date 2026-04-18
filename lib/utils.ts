import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tailwind 클래스 문자열을 병합해 반환한다. */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}
