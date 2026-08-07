import Image from "next/image";
import { cn } from "@/lib/utils";

export function LogoMark({
  className,
  dark,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden",
        dark && "brightness-0 invert",
        className,
      )}
    >
      <Image
        src="/brand/sswsco-logo.png"
        alt=""
        fill
        sizes="160px"
        className="pointer-events-none object-contain"
        priority
      />
    </span>
  );
}

export function LogoFull({
  className,
  markClassName,
  dark,
}: {
  className?: string;
  markClassName?: string;
  dark?: boolean;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <LogoMark
        dark={dark}
        className={cn(
          "h-16 w-36",
          markClassName,
          dark ? "opacity-95" : undefined,
        )}
      />
    </div>
  );
}
