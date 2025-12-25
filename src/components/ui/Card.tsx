"use client";

import { forwardRef, HTMLAttributes } from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined";
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const variantMap = {
  default: "bg-[var(--surface)] shadow-[var(--shadow)] border border-[var(--border-light)]",
  elevated: "bg-[var(--surface)] shadow-[var(--shadow-md)]",
  outlined: "bg-transparent border border-[var(--border)]",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", variant = "default", hoverable = false, padding = "md", children, ...props }, ref) => {
    const baseStyles = "rounded-[var(--radius)] transition-all duration-200";
    const hoverStyles = hoverable ? "hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 cursor-pointer" : "";
    
    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantMap[variant]} ${paddingMap[padding]} ${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// Animated version of Card
interface MotionCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  variant?: "default" | "elevated" | "outlined";
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children?: React.ReactNode;
}

export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  ({ className = "", variant = "default", hoverable = false, padding = "md", children, ...props }, ref) => {
    const baseStyles = "rounded-[var(--radius)] transition-colors duration-200";
    const hoverStyles = hoverable ? "cursor-pointer" : "";
    
    return (
      <motion.div
        ref={ref}
        className={`${baseStyles} ${variantMap[variant]} ${paddingMap[padding]} ${hoverStyles} ${className}`}
        whileHover={hoverable ? { y: -2, boxShadow: "var(--shadow-md)" } : undefined}
        whileTap={hoverable ? { scale: 0.98 } : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

MotionCard.displayName = "MotionCard";

// Card Header
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between mb-3 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = "CardHeader";

// Card Title
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = "", as: Component = "h3", children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={`text-base font-semibold text-[var(--text-primary)] ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = "CardTitle";

// Card Content
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = "CardContent";

export default Card;

