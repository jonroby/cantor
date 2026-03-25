import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export type {
	WithElementRef,
	WithoutChildren,
	WithoutChildrenOrChild,
	WithoutChild
} from 'bits-ui';
export type { ClassValue };

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
