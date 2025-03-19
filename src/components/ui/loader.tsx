import React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary";
  centered?: boolean;
  text?: string;
}

const Loader = ({
  className,
  size = "md",
  variant = "default",
  centered = false,
  text,
  ...props
}: LoaderProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const variantClasses = {
    default: "text-muted-foreground",
    primary: "text-primary",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        centered && "justify-center",
        className
      )}
      {...props}
    >
      <Loader2
        className={cn(
          "animate-spinner",
          sizeClasses[size],
          variantClasses[variant]
        )}
      />
      {text && (
        <span className={cn("text-sm", variantClasses[variant])}>{text}</span>
      )}
    </div>
  );
};

export { Loader }; 