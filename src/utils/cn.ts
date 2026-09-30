import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind classes with clsx conditionals
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
