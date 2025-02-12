import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const isMobile = () => {
  // Check viewport width
  const mobileWidth = 768; // You can adjust this breakpoint
  const viewportCheck = window.innerWidth <= mobileWidth;

  // Check user agent for mobile devices
  const userAgentCheck =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  return viewportCheck || userAgentCheck;
};

export { isMobile };
